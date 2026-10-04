import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { IngestQueue } from '../src/bl/alerts/ingestQueue';
import { AlertBL } from '../src/bl/alerts/alert.bl';
import { AlertRepository } from '../src/dal/alertRepository';
import { AlertCommentsRepository } from '../src/dal/alertCommentsRepository';
import { AlertHistoryRepository } from '../src/dal/alertHistoryRepository';
import { ResolvedAlertRepository } from '../src/dal/resolvedAlertRepository';
import { UserRepository } from '../src/dal/userRepository';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// The ingest queue (bl/alerts/ingestQueue.ts) coalesces webhook writes into one
// transaction per flush. These tests pin the contract the rest of the server relies
// on: everything lands, a POST is visible to the GET that follows it, a write that
// must observe earlier ingests (resolve) waits for them, and one bad row cannot
// take its batch-mates down with it.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

interface CountRow {
	n: number;
}

interface AlertListBody {
	data: { alerts: { id: string }[] };
}

const countActive = (prefix: string): number =>
	(db.prepare(`SELECT COUNT(*) AS n FROM alerts WHERE id LIKE ?`).get(`${prefix}%`) as CountRow).n;
const countResolved = (prefix: string): number =>
	(db.prepare(`SELECT COUNT(*) AS n FROM alerts_resolved WHERE id LIKE ?`).get(`${prefix}%`) as CountRow).n;

const postCustom = (id: string) =>
	app
		.post('/api/v1/alerts/custom')
		.set('Authorization', `Bearer ${jwtToken}`)
		.send({ id, alertName: `alert ${id}`, tags: { env: 'test' }, severity: 'warning' });

beforeAll(async () => {
	// A wide flush window for this file only, so the burst test provably batches
	// instead of flushing per request (ordering tests below are deterministic at the
	// BL level and do not depend on it).
	process.env.ALERTS_INGEST_FLUSH_MS = '150';
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

afterAll(() => {
	db.close();
});

describe('ingest batching through the webhook API', () => {
	test('a burst of concurrent webhooks all land, each responding only after commit', async () => {
		const ids = Array.from({ length: 300 }, (_, i) => `burst-${i}`);
		const responses = await Promise.all(ids.map((id) => postCustom(id)));
		expect(responses.every((res) => res.status === 200)).toBe(true);
		expect(countActive('burst-')).toBe(300);
	});

	test('a GET immediately after a POST sees the alert (the response waits for the flush)', async () => {
		await postCustom('visible-1');
		const res = await app.get('/api/v1/alerts?limit=500').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		const ids = (res.body as AlertListBody).data.alerts.map((alert) => alert.id);
		expect(ids).toContain('visible-1');
	});

	test('a resolve issued while the ingest is still queued lands after it (drain)', async () => {
		// Deterministic at the BL level: insertOrUpdateAlert() enqueues synchronously
		// before its first await, so after calling it un-awaited the row is provably
		// in the queue, not committed. Without drain() the resolve would run against a
		// not-yet-committed row and the alert would surface as firing right after.
		const bl = new AlertBL(
			new AlertRepository(db),
			new ResolvedAlertRepository(db),
			new AlertCommentsRepository(db),
			new AlertHistoryRepository(db),
			new UserRepository(db)
		);
		const now = new Date().toISOString();
		const pending = bl.insertOrUpdateAlert({
			id: 'race-1',
			type: 'Custom',
			status: 'firing',
			tags: {},
			startsAt: now,
			updatedAt: now,
			alertUrl: '',
			alertName: 'race',
		});
		expect(countActive('race-1')).toBe(0); // still only queued
		const resolved = await bl.resolveAlert('race-1', { id: null, name: null });
		await pending;
		expect(resolved).toBe(true);
		expect(countActive('race-1')).toBe(0);
		expect(countResolved('race-1')).toBe(1);
	});

	test('Grafana reconciliation drains the queue before deciding what to resolve', async () => {
		const bl = new AlertBL(
			new AlertRepository(db),
			new ResolvedAlertRepository(db),
			new AlertCommentsRepository(db),
			new AlertHistoryRepository(db),
			new UserRepository(db)
		);
		const now = new Date().toISOString();
		const pending = bl.insertOrUpdateAlert({
			id: 'grafana-queued',
			type: 'Grafana',
			status: 'firing',
			tags: {},
			startsAt: now,
			updatedAt: now,
			alertUrl: '',
			alertName: 'queued grafana alert',
		});
		// Empty active set = "nothing is firing any more": the queued alert must be
		// committed first so this resolves it, instead of it landing as firing afterwards.
		await bl.resolveNonActiveAlerts(new Set(), 'Grafana');
		await pending;
		expect(countActive('grafana-queued')).toBe(0);
		expect(countResolved('grafana-queued')).toBe(1);
	});

	test('a re-fire after resolve still drops the resolved copy inside the batch', async () => {
		await postCustom('refire-1');
		await app.delete('/api/v1/alerts/refire-1').set('Authorization', `Bearer ${jwtToken}`);
		expect(countResolved('refire-1')).toBe(1);
		await postCustom('refire-1');
		expect(countActive('refire-1')).toBe(1);
		expect(countResolved('refire-1')).toBe(0);
	});
});

describe('IngestQueue', () => {
	test('refuses a maxBatch that could never drain (0, NaN, negative) and a NaN flushMs', () => {
		const flush = (items: number[]) => Promise.resolve(items);
		for (const maxBatch of [0, -1, NaN, 2.5]) {
			expect(() => new IngestQueue<number, number>(flush, { flushMs: 0, maxBatch })).toThrow(/maxBatch/);
		}
		expect(() => new IngestQueue<number, number>(flush, { flushMs: NaN, maxBatch: 10 })).toThrow(/flushMs/);
	});

	test('coalesces items enqueued within one flush window into a single batch', async () => {
		const flush = vi.fn((items: number[]) => Promise.resolve(items.map((n) => n * 2)));
		const queue = new IngestQueue<number, number>(flush, { flushMs: 5, maxBatch: 100 });
		const results = await Promise.all([1, 2, 3, 4, 5].map((n) => queue.enqueue(n)));
		expect(results).toEqual([2, 4, 6, 8, 10]);
		expect(flush).toHaveBeenCalledTimes(1);
		expect(flush.mock.calls[0][0]).toEqual([1, 2, 3, 4, 5]);
	});

	test('splits at maxBatch and flushes the full batch immediately', async () => {
		const flush = vi.fn((items: number[]) => Promise.resolve(items));
		const queue = new IngestQueue<number, number>(flush, { flushMs: 1000, maxBatch: 3 });
		const results = await Promise.all([1, 2, 3, 4, 5, 6, 7].map((n) => queue.enqueue(n)));
		expect(results).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(flush.mock.calls.map((call) => call[0])).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
	});

	test('a failing batch is retried item by item: only the bad item rejects', async () => {
		const flush = vi.fn((items: string[]) => {
			if (items.includes('bad')) return Promise.reject(new Error('constraint failed'));
			return Promise.resolve(items.map((item) => item.toUpperCase()));
		});
		const queue = new IngestQueue<string, string>(flush, { flushMs: 1, maxBatch: 100 });
		const [good1, bad, good2] = await Promise.allSettled([
			queue.enqueue('good1'),
			queue.enqueue('bad'),
			queue.enqueue('good2'),
		]);
		expect(good1).toEqual({ status: 'fulfilled', value: 'GOOD1' });
		expect(good2).toEqual({ status: 'fulfilled', value: 'GOOD2' });
		expect(bad.status).toBe('rejected');
		// 1 batch attempt + 3 single retries
		expect(flush).toHaveBeenCalledTimes(4);
	});

	test('drain() resolves only once nothing is pending or in flight', async () => {
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const flush = vi.fn(async (items: number[]) => {
			await gate;
			return items;
		});
		const queue = new IngestQueue<number, number>(flush, { flushMs: 1000, maxBatch: 100 });
		void queue.enqueue(1);
		let drained = false;
		const draining = queue.drain().then(() => {
			drained = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(drained).toBe(false);
		release();
		await draining;
		expect(drained).toBe(true);
		expect(queue.size).toBe(0);
	});
});
