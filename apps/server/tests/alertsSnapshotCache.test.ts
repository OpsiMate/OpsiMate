import { beforeAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// Integration coverage for the alerts snapshot cache at the HTTP layer: the
// content-derived ETag / 304 contract, TTL'd caching, and write-path invalidation.
// setup.ts pins ALERTS_SNAPSHOT_TTL_MS=0 for the rest of the suite; this file opts
// into a long TTL before building its app so caching is actually observable.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const insertAlert = (id: string, name: string) => {
	db.prepare(
		`INSERT INTO alerts (id, status, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url, is_dismissed)
		 VALUES (?, 'active', '{}', ?, ?, ?, ?, 'Summary', NULL, 0)`
	).run(id, new Date().toISOString(), new Date().toISOString(), `https://example.com/${id}`, name);
};

const getAlerts = () => app.get('/api/v1/alerts').set('Authorization', `Bearer ${jwtToken}`);

beforeAll(async () => {
	process.env.ALERTS_SNAPSHOT_TTL_MS = '60000';
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
	// Restore the suite-wide default so files sharing this worker are unaffected.
	process.env.ALERTS_SNAPSHOT_TTL_MS = '0';
	insertAlert('cache-alert-1', 'Cache Alert 1');
});

describe('alerts snapshot cache over HTTP', () => {
	test('sets a stable ETag and honors If-None-Match with a bodyless 304', async () => {
		const first = await getAlerts();
		expect(first.status).toBe(200);
		const etag = first.headers['etag'];
		expect(etag).toBeTruthy();
		expect(first.headers['cache-control']).toBe('no-cache');
		expect(first.body.data.alerts).toHaveLength(1);

		const revalidated = await app
			.get('/api/v1/alerts')
			.set('Authorization', `Bearer ${jwtToken}`)
			.set('If-None-Match', etag);
		expect(revalidated.status).toBe(304);
		expect(revalidated.text ?? '').toBe('');
	});

	test('serves from cache within the TTL: direct DB writes are invisible', async () => {
		const before = await getAlerts();
		insertAlert('cache-alert-2', 'Cache Alert 2');
		const after = await getAlerts();

		// The cache cannot see a write that bypassed the BL — that is the point of the
		// test: it proves responses are truly served from the snapshot, not recomputed.
		expect(after.body.data.alerts).toHaveLength(before.body.data.alerts.length);
		expect(after.headers['etag']).toBe(before.headers['etag']);
	});

	test('a mutation through the API invalidates: the immediate refetch sees it', async () => {
		const before = await getAlerts();
		const etagBefore = before.headers['etag'];

		const silence = await app
			.patch('/api/v1/alerts/cache-alert-1/silence')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({});
		expect(silence.status).toBe(200);

		const after = await getAlerts();
		const silenced = after.body.data.alerts.find((a: { id: string }) => a.id === 'cache-alert-1');
		expect(silenced.isSilenced).toBe(true);
		expect(after.headers['etag']).not.toBe(etagBefore);
		// The recompute also finally surfaces the direct DB write the previous test
		// proved invisible — invalidation rebuilds from the source of truth.
		expect(after.body.data.alerts.map((a: { id: string }) => a.id)).toContain('cache-alert-2');
		// And the stale ETag no longer revalidates.
		const revalidated = await app
			.get('/api/v1/alerts')
			.set('Authorization', `Bearer ${jwtToken}`)
			.set('If-None-Match', etagBefore);
		expect(revalidated.status).toBe(200);
	});
});
