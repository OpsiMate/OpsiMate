import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { AlertBL } from '../src/bl/alerts/alert.bl';
import { SnapshotCache } from '../src/bl/alerts/snapshotCache';
import { AlertRepository } from '../src/dal/alertRepository';
import { AlertCommentsRepository } from '../src/dal/alertCommentsRepository';
import { AlertHistoryRepository } from '../src/dal/alertHistoryRepository';
import { CacheGenerationRepository } from '../src/dal/cacheGenerationRepository';
import { ResolvedAlertRepository } from '../src/dal/resolvedAlertRepository';
import { UserRepository } from '../src/dal/userRepository';
import { setupDB, setupExpressApp } from './setup';

// In cluster mode every worker keeps its own in-memory snapshot of the alert lists.
// A write in worker A must be visible from worker B on B's very next read — not after
// B's TTL expires. Two AlertBL instances over one database stand in for two workers;
// the TTL is set far beyond the test so only the shared cache_generation row can
// explain a fresh read.

let db: Database.Database;
let workerA: AlertBL;
let workerB: AlertBL;

const alert = (id: string) => {
	const now = new Date().toISOString();
	return {
		id,
		type: 'Custom' as const,
		status: 'firing' as const,
		tags: {},
		startsAt: now,
		updatedAt: now,
		alertUrl: '',
		alertName: `alert ${id}`,
	};
};

const idsSeenBy = async (bl: AlertBL) => (await bl.getAllAlerts()).map((a) => a.id);

beforeAll(async () => {
	db = await setupDB();
	await setupExpressApp(db); // creates every table, incl. cache_generation
	process.env.ALERTS_SNAPSHOT_TTL_MS = '600000'; // read at AlertBL construction
	const build = () =>
		new AlertBL(
			new AlertRepository(db),
			new ResolvedAlertRepository(db),
			new AlertCommentsRepository(db),
			new AlertHistoryRepository(db),
			new UserRepository(db),
			new CacheGenerationRepository(db)
		);
	workerA = build();
	workerB = build();
});

afterAll(() => {
	process.env.ALERTS_SNAPSHOT_TTL_MS = '0';
	db.close();
});

describe('cross-process snapshot invalidation', () => {
	test('an ingest in one worker is visible from the other worker on its next read', async () => {
		expect(await idsSeenBy(workerB)).toEqual([]); // B now holds a cached (empty) snapshot
		await workerA.insertOrUpdateAlert(alert('from-a'));
		expect(await idsSeenBy(workerB)).toEqual(['from-a']);
	});

	test("a resolve in one worker drops the alert from the other worker's list", async () => {
		expect(await idsSeenBy(workerA)).toContain('from-a');
		await workerB.resolveAlert('from-a', { id: null, name: null });
		expect(await idsSeenBy(workerA)).not.toContain('from-a');
		expect((await workerA.getResolvedAlertsSnapshot()).value.map((a) => a.id)).toContain('from-a');
	});

	test('with no writes in between, the cached snapshot is served (no rebuild)', async () => {
		let computes = 0;
		const repo = new CacheGenerationRepository(db);
		const cache = new SnapshotCache<number>(
			() => {
				computes++;
				return Promise.resolve(computes);
			},
			600_000,
			() => repo.readSync()
		);
		await cache.get();
		await cache.get();
		expect(computes).toBe(1);
		repo.bumpSync(); // "another process wrote"
		await cache.get();
		expect(computes).toBe(2);
	});
});
