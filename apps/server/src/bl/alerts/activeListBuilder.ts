import crypto from 'node:crypto';
import { Alert, Logger } from '@OpsiMate/shared';
import { AlertCommentsRepository } from '../../dal/alertCommentsRepository';
import { AlertHistoryRepository } from '../../dal/alertHistoryRepository';
import { AlertRepository } from '../../dal/alertRepository';
import { FiringTimesIndex } from './firingTimesIndex';
import { PreparedRules } from './preparedRules';

const logger = new Logger('bl/activeListBuilder');

// What a listed alert was assembled from, so the next build can tell it is unchanged.
interface AssembledAlert {
	source: Alert;
	rulesKey: string;
	firingTimes: string[] | undefined;
	lastComment: string | null;
	alert: Alert;
}

export interface ActiveListBuild {
	alerts: Alert[];
	// The alerts (re)derived by this build — everything on the first build, only what
	// changed afterwards. What a worker thread ships to the main thread.
	changed: Alert[];
	// Content-derived digest of the list; SnapshotCache hashes it into the ETag.
	fingerprint: string;
}

// Rule sets are wired after construction (app.ts), so the builder takes providers.
export type RulesProvider = () => Promise<PreparedRules>;
const NO_RULES: PreparedRules = { key: 'none', apply: (alert) => alert };
export const noRules: RulesProvider = () => Promise.resolve(NO_RULES);

// Builds the active alerts list. It is rebuilt whenever anything changed — once a
// second under a webhook storm — but almost every alert in it is exactly as it was.
// So the work is keyed per alert on its inputs, and an alert whose inputs are
// unchanged is the same object as last time: the repository returns the same base
// object for an unchanged row, FiringTimesIndex the same array for unchanged history,
// and the rule sets a key that only moves when a rule (or a mute schedule window)
// does. Enrich before mute so mute policy rules can match enrichment-added tags; then
// firing times and the newest comment, both best-effort — a failed lookup never
// breaks the listing.
//
// Runs on the main thread, or inside a worker thread over its own DB connection (see
// snapshotWorker.ts) — the state it keeps between builds lives wherever it runs.
export class ActiveListBuilder {
	private readonly firingTimes: FiringTimesIndex;
	private assembled = new Map<string, AssembledAlert>();
	// Builds run one at a time. SnapshotCache.invalidate() can start a new compute
	// while an older one is still awaiting; the cache discards the older RESULT, but
	// both would otherwise interleave on the state above — the older one finishing
	// last would overwrite `assembled` with a stale map (every alert re-derived on the
	// next build) and race the index's eviction. Queued, the newer build simply runs
	// after the older one and stores last.
	private buildQueue: Promise<unknown> = Promise.resolve();

	constructor(
		private readonly alertRepo: AlertRepository,
		private readonly alertCommentsRepo: AlertCommentsRepository,
		alertHistoryRepo: AlertHistoryRepository,
		private readonly enricher: RulesProvider = noRules,
		private readonly muter: RulesProvider = noRules
	) {
		this.firingTimes = new FiringTimesIndex(alertRepo, alertHistoryRepo);
	}

	build(): Promise<ActiveListBuild> {
		const run = this.buildQueue.then(() => this.buildNow());
		this.buildQueue = run.catch(() => undefined);
		return run;
	}

	private async buildNow(): Promise<ActiveListBuild> {
		const sources = await this.alertRepo.getAllAlerts();
		const ids = sources.map((alert) => alert.id);
		const [enricher, muter, firing, comments] = await Promise.all([
			this.enricher(),
			this.muter(),
			this.firingTimes.refresh(ids).catch((error: unknown) => {
				logger.error('Failed to attach firing times to alerts', error);
				return new Map<string, string[]>();
			}),
			this.alertCommentsRepo.getLatestCommentsByAlertIds(ids).catch((error: unknown) => {
				logger.error('Failed to attach last comments to alerts', error);
				const none: Record<string, string> = {};
				return none;
			}),
		]);
		const rulesKey = `${enricher.key}\n${muter.key}`;
		const next = new Map<string, AssembledAlert>();
		const changed: Alert[] = [];
		const alerts = sources.map((source) => {
			const firingTimes = firing.get(source.id);
			const lastComment = comments[source.id] ?? null;
			const previous = this.assembled.get(source.id);
			if (
				previous &&
				previous.source === source &&
				previous.rulesKey === rulesKey &&
				previous.firingTimes === firingTimes &&
				previous.lastComment === lastComment
			) {
				next.set(source.id, previous);
				return previous.alert;
			}
			const ruled = muter.apply(enricher.apply(source));
			const alert: Alert = firingTimes ? { ...ruled, firingTimes, lastComment } : { ...ruled, lastComment };
			next.set(source.id, { source, rulesKey, firingTimes, lastComment, alert });
			changed.push(alert);
			return alert;
		});
		this.assembled = next;
		return { alerts, changed, fingerprint: alertListFingerprint(alerts) };
	}
}

// Content digest of the list without serializing it. Each object's digest is a
// stringify+hash of that ONE alert, computed once and remembered for as long as the
// object lives; unchanged alerts are the same objects, so a build hashes only what
// changed. Content-derived like the JSON hash it replaces: an alert re-derived to
// identical content gets the same digest, and a restart yields the same ETags.
const alertDigests = new WeakMap<Alert, string>();
export const alertListFingerprint = (alerts: Alert[]): string => {
	let out = '';
	for (const alert of alerts) {
		let digest = alertDigests.get(alert);
		if (digest === undefined) {
			digest = crypto.createHash('sha1').update(JSON.stringify(alert)).digest('base64');
			alertDigests.set(alert, digest);
		}
		out += digest;
	}
	return out;
};
