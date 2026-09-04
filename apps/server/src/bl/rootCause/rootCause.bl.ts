import {
	AlertRootCause,
	AuditActionType,
	AuditResourceType,
	Logger,
	RateRootCauseResult,
	RootCauseRating,
	User,
} from '@OpsiMate/shared';
import { RootCauseRecord, RootCauseRepository, UpsertRootCauseInput } from '../../dal/rootCauseRepository';
import { AuditBL } from '../audit/audit.bl';

const logger = new Logger('bl/rootCause/rootCause.bl');

// Signals "no such alert" / "no analysis to rate" to the controller without string-
// matching on error messages (see #894's review for why instanceof beats includes()).
export class RootCauseNotFoundError extends Error {}

// The feedback callback carries NO credentials of ours and its response is never
// surfaced to anyone, so the SSRF exposure is a blind POST from a writer already
// trusted with the API token. Self-hosted reality is that the sender's system lives
// on a private network, so private/loopback ranges are deliberately ALLOWED; the
// link-local range is not — 169.254.169.254 is the cloud metadata service, the one
// target where even a blind POST from the server's identity is worth refusing.
// Redirects are refused too, so an allowed host can't bounce the request there.
const isBlockedCallbackUrl = (raw: string): boolean => {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return true;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
	const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
	if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
	// IPv6 link-local, and the v4-mapped spelling of the metadata range.
	if (/^fe[89ab]/.test(host)) return true;
	if (host.startsWith('::ffff:169.254.')) return true;
	return false;
};

const CALLBACK_TIMEOUT_MS = 3000;

// The client-facing shape: everything except the callback URLs.
const toPublic = (record: RootCauseRecord): AlertRootCause => ({
	alertId: record.alertId,
	source: record.source,
	content: record.content,
	rating: record.rating,
	ratedBy: record.ratedBy,
	ratedAt: record.ratedAt,
	createdAt: record.createdAt,
	updatedAt: record.updatedAt,
});

export class RootCauseBL {
	constructor(
		private rootCauseRepo: RootCauseRepository,
		private auditBL: AuditBL,
		// True when the id names a current alert, active or resolved. Injected so this
		// module needs no view into the alert repositories.
		private alertExists: (alertId: string) => Promise<boolean>
	) {}

	async upsert(input: UpsertRootCauseInput): Promise<AlertRootCause> {
		if (!(await this.alertExists(input.alertId))) {
			throw new RootCauseNotFoundError(`Alert ${input.alertId} not found`);
		}
		const record = await this.rootCauseRepo.upsert(input);
		return toPublic(record);
	}

	async get(alertId: string): Promise<AlertRootCause | null> {
		const record = await this.rootCauseRepo.getByAlertId(alertId);
		return record ? toPublic(record) : null;
	}

	// Stores the verdict FIRST, then fires the sender's callback for it. The stored
	// rating is the source of truth (and phase 2's eval signal); callback delivery is
	// best-effort and reported, never load-bearing.
	async rate(alertId: string, rating: RootCauseRating, user: User): Promise<RateRootCauseResult> {
		const updated = await this.rootCauseRepo.setRating(alertId, rating, user.fullName);
		if (!updated) {
			throw new RootCauseNotFoundError(`No root cause for alert ${alertId}`);
		}

		// Best-effort, like the callback below: the rating committed above and must not
		// be reported as failed (a 500 here would push the operator into re-rating,
		// duplicating callbacks) because the audit insert hiccuped.
		try {
			await this.auditBL.logAction({
				actionType: AuditActionType.UPDATE,
				resourceType: AuditResourceType.ROOT_CAUSE,
				resourceId: alertId,
				userId: Number(user.id),
				userName: user.fullName,
				resourceName: `root cause rated ${rating}`,
			});
		} catch (error) {
			logger.error('Failed to audit-log a root-cause rating (rating stored)', error);
		}

		const callbackUrl = rating === 'up' ? updated.feedbackUpUrl : updated.feedbackDownUrl;
		let callbackDelivered: boolean | null = null;
		if (callbackUrl) {
			callbackDelivered = await this.fireCallback(callbackUrl, {
				alertId,
				rating,
				ratedBy: updated.ratedBy,
				ratedAt: updated.ratedAt,
			});
		}
		return { rootCause: toPublic(updated), callbackDelivered };
	}

	async deleteForAlert(alertId: string): Promise<void> {
		await this.rootCauseRepo.deleteByAlertId(alertId);
	}

	private async fireCallback(url: string, body: Record<string, unknown>): Promise<boolean> {
		if (isBlockedCallbackUrl(url)) {
			logger.warn(`Refusing root-cause feedback callback to blocked URL host`);
			return false;
		}
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body),
				redirect: 'error',
				signal: AbortSignal.timeout(CALLBACK_TIMEOUT_MS),
			});
			return response.ok;
		} catch (error) {
			logger.warn(
				`Root-cause feedback callback failed: ${error instanceof Error ? error.message : String(error)}`
			);
			return false;
		}
	}
}
