import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, test } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// The custom webhook's status field: "resolved" resolves the alert with that id (the
// POST counterpart of DELETE /alerts/:id, which stays as it is); anything else fires.
// Senders have always been free to send a status (it used to be ignored), so nothing
// they send today may start failing.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

interface AlertIdRow {
	id: string;
}
interface ListBody {
	data: { alerts: AlertIdRow[] };
}

const post = (body: Record<string, unknown>) =>
	app.post('/api/v1/alerts/custom').set('Authorization', `Bearer ${jwtToken}`).send(body);
const activeIds = async () =>
	(
		(await app.get('/api/v1/alerts?limit=500').set('Authorization', `Bearer ${jwtToken}`)).body as ListBody
	).data.alerts.map((a) => a.id);
const resolvedIds = async () =>
	(
		(await app.get('/api/v1/alerts/resolved?limit=500').set('Authorization', `Bearer ${jwtToken}`)).body as ListBody
	).data.alerts.map((a) => a.id);

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

describe('POST /alerts/custom with a status', () => {
	test('no status, "firing", "active" or anything unknown fires the alert (unchanged behaviour)', async () => {
		for (const [id, status] of [
			['s-none', undefined],
			['s-firing', 'firing'],
			['s-active', 'active'],
			['s-weird', 'whatever'],
		] as const) {
			const res = await post({ id, alertName: `alert ${id}`, tags: {}, ...(status ? { status } : {}) });
			expect(res.status).toBe(200);
			expect(res.body.data).toEqual({ alertId: id, status: 'firing' });
		}
		expect(await activeIds()).toEqual(expect.arrayContaining(['s-none', 's-firing', 's-active', 's-weird']));
	});

	test('legacy status values that used to be ignored still fire: a number, a long string', async () => {
		const numeric = await post({ id: 's-number', alertName: 'n', tags: {}, status: 42 });
		expect(numeric.status).toBe(200);
		expect(numeric.body.data.status).toBe('firing');
		const long = await post({ id: 's-long', alertName: 'l', tags: {}, status: 'x'.repeat(500) });
		expect(long.status).toBe(200);
		expect(long.body.data.status).toBe('firing');
		expect(await activeIds()).toEqual(expect.arrayContaining(['s-number', 's-long']));
	});

	test('a resolve needs only the id and the status — other fields are not required', async () => {
		await post({ id: 'r-min', alertName: 'minimal', tags: {} });
		const res = await post({ id: 'r-min', status: 'resolved' });
		expect(res.status).toBe(200);
		expect(res.body.data).toEqual({ alertId: 'r-min', status: 'resolved', resolved: true });
		expect(await resolvedIds()).toEqual(expect.arrayContaining(['r-min']));
		// A firing POST still needs the full payload.
		const firing = await post({ id: 'r-min', status: 'firing' });
		expect(firing.status).toBe(400);
	});

	test('"resolved" resolves the active alert with that id — any casing', async () => {
		await post({ id: 'r-1', alertName: 'to resolve', tags: {} });
		await post({ id: 'r-2', alertName: 'to resolve too', tags: {} });
		expect(await activeIds()).toEqual(expect.arrayContaining(['r-1', 'r-2']));

		const lower = await post({ id: 'r-1', alertName: 'to resolve', tags: {}, status: 'resolved' });
		expect(lower.status).toBe(200);
		expect(lower.body.data).toEqual({ alertId: 'r-1', status: 'resolved', resolved: true });
		const upper = await post({ id: 'r-2', alertName: 'to resolve too', tags: {}, status: ' RESOLVED ' });
		expect(upper.body.data).toEqual({ alertId: 'r-2', status: 'resolved', resolved: true });

		expect(await activeIds()).not.toEqual(expect.arrayContaining(['r-1']));
		expect(await activeIds()).not.toEqual(expect.arrayContaining(['r-2']));
		expect(await resolvedIds()).toEqual(expect.arrayContaining(['r-1', 'r-2']));
	});

	test('resolving an unknown or already-resolved id is a 200 no-op (idempotent for retries)', async () => {
		const unknown = await post({ id: 'never-existed', alertName: 'x', tags: {}, status: 'resolved' });
		expect(unknown.status).toBe(200);
		expect(unknown.body.data).toEqual({ alertId: 'never-existed', status: 'resolved', resolved: false });
		const again = await post({ id: 'r-1', alertName: 'to resolve', tags: {}, status: 'resolved' });
		expect(again.status).toBe(200);
		expect(again.body.data.resolved).toBe(false);
		expect(await activeIds()).not.toEqual(expect.arrayContaining(['never-existed']));
	});

	test('a resolved alert fires again on the next firing POST', async () => {
		await post({ id: 'r-1', alertName: 'to resolve', tags: {} });
		expect(await activeIds()).toEqual(expect.arrayContaining(['r-1']));
		expect(await resolvedIds()).not.toEqual(expect.arrayContaining(['r-1']));
	});

	test('the resolve is recorded in the alert history without an acting user', async () => {
		await post({ id: 'r-1', alertName: 'to resolve', tags: {}, status: 'resolved' });
		const history = await app.get('/api/v1/alerts/r-1/history').set('Authorization', `Bearer ${jwtToken}`);
		expect(history.status).toBe(200);
		expect(JSON.stringify(history.body)).toMatch(/resolved/i);
	});

	test('DELETE /alerts/:id keeps resolving as before', async () => {
		await post({ id: 'd-1', alertName: 'delete path', tags: {} });
		const res = await app.delete('/api/v1/alerts/d-1').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(await resolvedIds()).toEqual(expect.arrayContaining(['d-1']));
	});
});
