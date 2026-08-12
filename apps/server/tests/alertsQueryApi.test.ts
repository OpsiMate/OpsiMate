import { beforeAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// HTTP contract of the Phase-1 query endpoints: param parsing, paging envelope,
// facets, legacy behavior when no query params are sent. Engine semantics themselves
// are covered by alertQueryEngine.test.ts and the client suite.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const insertAlert = (id: string, name: string, tags: Record<string, string>, startsAt: string) => {
	db.prepare(
		`INSERT INTO alerts (id, status, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url, is_dismissed)
		 VALUES (?, 'firing', ?, ?, ?, ?, ?, 'Summary', NULL, 0)`
	).run(id, JSON.stringify(tags), startsAt, new Date().toISOString(), `https://example.com/${id}`, name);
};

const get = (url: string) => app.get(url).set('Authorization', `Bearer ${jwtToken}`);

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
	for (let i = 1; i <= 30; i++) {
		insertAlert(
			`q-${String(i).padStart(2, '0')}`,
			`Query Alert ${i}`,
			{ env: i % 3 === 0 ? 'prod' : 'staging' },
			new Date(2026, 0, i, 12, 0, 0).toISOString()
		);
	}
});

describe('GET /alerts with query params', () => {
	test('limit pages the list and reports the filtered total', async () => {
		const res = await get('/api/v1/alerts?limit=10&sort=startsAt&dir=desc');
		expect(res.status).toBe(200);
		expect(res.body.data.alerts).toHaveLength(10);
		expect(res.body.data.total).toBe(30);
		expect(res.body.data.nextCursor).toBeTruthy();
		// startsAt desc: latest (day 30) first
		expect(res.body.data.alerts[0].id).toBe('q-30');
	});

	test('cursor continues the scroll without duplicates', async () => {
		const first = await get('/api/v1/alerts?limit=10&sort=startsAt&dir=desc');
		const second = await get(
			`/api/v1/alerts?limit=10&sort=startsAt&dir=desc&cursor=${encodeURIComponent(first.body.data.nextCursor)}`
		);
		const firstIds = first.body.data.alerts.map((a: { id: string }) => a.id);
		const secondIds = second.body.data.alerts.map((a: { id: string }) => a.id);
		expect(secondIds).toHaveLength(10);
		expect(new Set([...firstIds, ...secondIds]).size).toBe(20);
	});

	test('sidebar filters apply server-side with the same record shape the client stores', async () => {
		const filters = encodeURIComponent(JSON.stringify({ 'tagKey:env': ['prod'] }));
		const res = await get(`/api/v1/alerts?filters=${filters}&limit=100`);
		expect(res.body.data.total).toBe(10);
		for (const alert of res.body.data.alerts) {
			expect(alert.tags.env).toBe('prod');
		}
	});

	test('search applies server-side', async () => {
		const res = await get('/api/v1/alerts?search=alert%203&limit=100');
		// "alert 3" matches "Query Alert 3" and "Query Alert 30"
		expect(res.body.data.total).toBe(2);
	});

	test('paged responses carry a content ETag and honor If-None-Match', async () => {
		const first = await get('/api/v1/alerts?limit=5');
		const etag = first.headers['etag'];
		expect(etag).toBeTruthy();
		const revalidated = await get('/api/v1/alerts?limit=5').set('If-None-Match', etag);
		expect(revalidated.status).toBe(304);
	});

	test('no query params keeps the legacy full-snapshot envelope', async () => {
		const res = await get('/api/v1/alerts');
		expect(res.status).toBe(200);
		expect(res.body.data.alerts).toHaveLength(30);
		expect(res.body.data.total).toBeUndefined();
		expect(res.body.data.nextCursor).toBeUndefined();
	});

	test('malformed params are a 400, not a 500', async () => {
		const bad = await get('/api/v1/alerts?filters=not-json');
		expect(bad.status).toBe(400);
		expect(bad.body.success).toBe(false);
		const badLimit = await get('/api/v1/alerts?limit=0');
		expect(badLimit.status).toBe(400);
	});
});

describe('GET /alerts/facets', () => {
	test('returns faceted counts with the sidebar semantics', async () => {
		const fields = encodeURIComponent(JSON.stringify(['tagKey:env', 'status']));
		const filters = encodeURIComponent(JSON.stringify({ 'tagKey:env': ['prod'] }));
		const res = await get(`/api/v1/alerts/facets?fields=${fields}&filters=${filters}`);
		expect(res.status).toBe(200);
		// A facet is not constrained by its own filter...
		expect(res.body.data.facets['tagKey:env']).toEqual({ prod: 10, staging: 20 });
		// ...but other facets are.
		expect(res.body.data.facets['status']).toEqual({ Firing: 10 });
		expect(res.body.data.total).toBe(30);
	});

	test('omitting fields defaults to the base fields plus every tag key, and reports tag keys', async () => {
		const res = await get('/api/v1/alerts/facets');
		expect(res.status).toBe(200);
		expect(Object.keys(res.body.data.facets)).toEqual(
			expect.arrayContaining(['status', 'severity', 'type', 'alertName', 'owner', 'tagKey:env'])
		);
		expect(res.body.data.tagKeys).toEqual([{ key: 'env', label: 'Env', values: ['prod', 'staging'] }]);
		expect(res.body.data.silencedTotal).toBe(0);
	});
});
