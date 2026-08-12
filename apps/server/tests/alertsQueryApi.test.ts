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

describe('GET /alerts/resolved with query params', () => {
	test('malformed params are a 400, not a 500', async () => {
		const res = await get('/api/v1/alerts/resolved?filters=not-json');
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	test('unparseable from/to dates are a 400, not an empty 200', async () => {
		const res = await get('/api/v1/alerts?from=yesterday');
		expect(res.status).toBe(400);
	});

	test('paging envelope matches the active endpoint', async () => {
		const res = await get('/api/v1/alerts/resolved?limit=5');
		expect(res.status).toBe(200);
		expect(res.body.data).toHaveProperty('total');
		expect(res.body.data).toHaveProperty('nextCursor');
	});
});

describe('GET /alerts/groups', () => {
	test('returns group counts + rollup status over the whole matching set, no alerts', async () => {
		const groupBy = encodeURIComponent(JSON.stringify(['tagKey:env']));
		const res = await get(`/api/v1/alerts/groups?groupBy=${groupBy}`);
		expect(res.status).toBe(200);
		const groups = res.body.data.groups;
		expect(groups.map((g: { value: string; count: number }) => [g.value, g.count])).toEqual([
			['prod', 10],
			['staging', 20],
		]);
		expect(groups[0].status).toBe('firing');
		expect(groups[0].key).toBe('root:prod');
		expect(groups[0]).not.toHaveProperty('alerts');
	});

	test('nested groupBy nests counts under parent keys', async () => {
		const groupBy = encodeURIComponent(JSON.stringify(['tagKey:env', 'severity']));
		const res = await get(`/api/v1/alerts/groups?groupBy=${groupBy}`);
		const prod = res.body.data.groups.find((g: { value: string }) => g.value === 'prod');
		expect(prod.children.length).toBeGreaterThan(0);
		expect(prod.children[0].key.startsWith('root:prod:')).toBe(true);
		const childSum = prod.children.reduce((n: number, c: { count: number }) => n + c.count, 0);
		expect(childSum).toBe(prod.count);
	});

	test('filters and search constrain the summaries like the list', async () => {
		const groupBy = encodeURIComponent(JSON.stringify(['tagKey:env']));
		const filters = encodeURIComponent(JSON.stringify({ 'tagKey:env': ['prod'] }));
		const res = await get(`/api/v1/alerts/groups?groupBy=${groupBy}&filters=${filters}`);
		expect(res.body.data.groups).toHaveLength(1);
		expect(res.body.data.groups[0].count).toBe(10);
	});

	test('date grouping buckets by the VIEWER timezone, not the server clock', async () => {
		// 20:00 UTC is the same instant but a different calendar day in Tokyo (+9,
		// next day) vs Los Angeles (-7/-8, same day) — an implementation that ignores
		// timeZone cannot bucket this alert differently per zone.
		insertAlert('tz-boundary', 'TZ Boundary Alert', { env: 'prod' }, '2026-03-15T20:00:00.000Z');
		const groupBy = encodeURIComponent(JSON.stringify(['startsAt']));
		const search = 'TZ%20Boundary';

		const tokyo = await get(`/api/v1/alerts/groups?groupBy=${groupBy}&search=${search}&timeZone=Asia/Tokyo`);
		expect(tokyo.status).toBe(200);
		expect(tokyo.body.data.groups.map((g: { value: string }) => g.value)).toEqual(['2026-03-16']);

		const la = await get(`/api/v1/alerts/groups?groupBy=${groupBy}&search=${search}&timeZone=America/Los_Angeles`);
		expect(la.body.data.groups.map((g: { value: string }) => g.value)).toEqual(['2026-03-15']);

		db.prepare('DELETE FROM alerts WHERE id = ?').run('tz-boundary');
	});

	test('group keys are collision-safe when values contain the delimiter', async () => {
		insertAlert('colon-tag', 'Colon Tag Alert', { env: 'a:b' }, new Date(2026, 0, 2, 12, 0, 0).toISOString());
		const groupBy = encodeURIComponent(JSON.stringify(['tagKey:env']));
		const res = await get(`/api/v1/alerts/groups?groupBy=${groupBy}`);
		const colonGroup = res.body.data.groups.find((g: { value: string }) => g.value === 'a:b');
		expect(colonGroup.key).toBe('root:a%3Ab');
		db.prepare('DELETE FROM alerts WHERE id = ?').run('colon-tag');
	});

	test('groupBy is required and malformed params are a 400', async () => {
		expect((await get('/api/v1/alerts/groups')).status).toBe(400);
		expect((await get('/api/v1/alerts/groups?groupBy=not-json')).status).toBe(400);
	});

	test('resolved endpoint exists with the same contract', async () => {
		const groupBy = encodeURIComponent(JSON.stringify(['severity']));
		const res = await get(`/api/v1/alerts/resolved/groups?groupBy=${groupBy}`);
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body.data.groups)).toBe(true);
	});
});
