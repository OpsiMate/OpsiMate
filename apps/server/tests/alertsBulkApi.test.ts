import { beforeAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// HTTP contract of POST /alerts/bulk (Phase 2b): one request mutates many alerts,
// scoped by explicit ids or by the same query the list endpoints speak. The underlying
// single-alert semantics (history events, ownership takeover, comments) are covered by
// their own suites — here we verify scoping, counts, and validation.

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
const postBulk = (body: object) =>
	app.post('/api/v1/alerts/bulk').set('Authorization', `Bearer ${jwtToken}`).send(body);

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
	for (let i = 1; i <= 20; i++) {
		insertAlert(
			`b-${String(i).padStart(2, '0')}`,
			`Bulk Alert ${i}`,
			{ env: i % 2 === 0 ? 'prod' : 'staging' },
			new Date(2026, 0, i, 12, 0, 0).toISOString()
		);
	}
});

describe('POST /alerts/bulk', () => {
	test('silence by explicit ids silences exactly those alerts and reports counts', async () => {
		const res = await postBulk({ action: 'silence', ids: ['b-01', 'b-03'], silencedUntil: null });
		expect(res.status).toBe(200);
		expect(res.body.data).toEqual({ matched: 2, succeeded: 2, failed: 0 });

		const list = await get('/api/v1/alerts?limit=100');
		const byId = new Map(list.body.data.alerts.map((a: { id: string }) => [a.id, a]));
		expect((byId.get('b-01') as { isSilenced: boolean }).isSilenced).toBe(true);
		expect((byId.get('b-03') as { isSilenced: boolean }).isSilenced).toBe(true);
		expect((byId.get('b-05') as { isSilenced: boolean }).isSilenced).toBe(false);
	});

	test('unknown ids count as failed, not silently succeeded', async () => {
		const res = await postBulk({ action: 'unsilence', ids: ['b-01', 'no-such-alert'] });
		expect(res.status).toBe(200);
		expect(res.body.data).toEqual({ matched: 2, succeeded: 1, failed: 1 });
	});

	test('assignOwner by ids sets the owner on every target', async () => {
		// The first registered user (the token's owner) gets id 1.
		const res = await postBulk({ action: 'assignOwner', ids: ['b-02', 'b-04'], ownerId: '1' });
		expect(res.body.data.succeeded).toBe(2);

		const list = await get('/api/v1/alerts?limit=100');
		const owned = list.body.data.alerts.filter((a: { id: string; ownerId: string | null }) =>
			['b-02', 'b-04'].includes(a.id)
		);
		expect(owned).toHaveLength(2);
		for (const alert of owned) {
			expect(String(alert.ownerId)).toBe('1');
		}
	});

	test('comment by ids adds the same comment to every target', async () => {
		const res = await postBulk({ action: 'comment', ids: ['b-06', 'b-08'], comment: 'bulk note' });
		expect(res.body.data).toEqual({ matched: 2, succeeded: 2, failed: 0 });

		const comments = await get('/api/v1/alerts/b-06/comments');
		const bodies = (comments.body.data.comments as Array<{ comment: string }>).map((c) => c.comment);
		expect(bodies).toContain('bulk note');
	});

	test('comment on an unknown id counts as failed and writes no orphan row', async () => {
		const res = await postBulk({ action: 'comment', ids: ['ghost-alert'], comment: 'orphan?' });
		expect(res.body.data).toEqual({ matched: 1, succeeded: 0, failed: 1 });

		const comments = await get('/api/v1/alerts/ghost-alert/comments');
		expect(comments.body.data.comments).toHaveLength(0);
	});

	test('resolve by query moves every matching alert to resolved — including unloaded ones', async () => {
		const before = await get('/api/v1/alerts?limit=100');
		const prodCount = before.body.data.alerts.filter(
			(a: { tags: Record<string, string> }) => a.tags.env === 'prod'
		).length;
		expect(prodCount).toBeGreaterThan(0);

		const res = await postBulk({
			action: 'resolve',
			query: { filters: { 'tagKey:env': ['prod'] } },
			comment: 'resolved in bulk',
		});
		expect(res.status).toBe(200);
		expect(res.body.data.matched).toBe(prodCount);
		expect(res.body.data.succeeded).toBe(prodCount);
		expect(res.body.data.failed).toBe(0);

		const after = await get('/api/v1/alerts?limit=100');
		expect(after.body.data.alerts.some((a: { tags: Record<string, string> }) => a.tags.env === 'prod')).toBe(false);

		const resolved = await get('/api/v1/alerts/resolved?limit=100');
		const resolvedProd = resolved.body.data.alerts.filter(
			(a: { tags: Record<string, string> }) => a.tags.env === 'prod'
		);
		expect(resolvedProd.length).toBe(prodCount);
	});

	test('query scope honors search the same way the list endpoint does', async () => {
		// "Bulk Alert 11" is unique; the query must match exactly the list result.
		const list = await get('/api/v1/alerts?search=alert%2011&limit=100');
		const expected = list.body.data.total;
		const res = await postBulk({ action: 'silence', query: { search: 'alert 11' }, silencedUntil: null });
		expect(res.body.data.matched).toBe(expected);
	});

	test('an empty query is the whole active list, not an error', async () => {
		const list = await get('/api/v1/alerts?limit=100');
		const res = await postBulk({ action: 'unsilence', query: {} });
		expect(res.status).toBe(200);
		expect(res.body.data.matched).toBe(list.body.data.total);
	});

	test('providing both ids and query is a 400', async () => {
		const res = await postBulk({ action: 'silence', ids: ['b-01'], query: {} });
		expect(res.status).toBe(400);
	});

	test('providing neither ids nor query is a 400', async () => {
		const res = await postBulk({ action: 'silence' });
		expect(res.status).toBe(400);
	});

	test('comment action without a comment is a 400', async () => {
		const res = await postBulk({ action: 'comment', ids: ['b-01'] });
		expect(res.status).toBe(400);
	});

	test('assignOwner without ownerId is a 400 (null means unassign and is valid)', async () => {
		const missing = await postBulk({ action: 'assignOwner', ids: ['b-02'] });
		expect(missing.status).toBe(400);

		// b-01 (staging) is still active at this point; the prod alerts were resolved above.
		const unassign = await postBulk({ action: 'assignOwner', ids: ['b-01'], ownerId: null });
		expect(unassign.status).toBe(200);
		expect(unassign.body.data.succeeded).toBe(1);
	});

	test('unknown action is a 400', async () => {
		const res = await postBulk({ action: 'explode', ids: ['b-01'] });
		expect(res.status).toBe(400);
	});
});
