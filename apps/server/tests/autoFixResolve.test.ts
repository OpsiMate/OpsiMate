import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { Alert } from '@OpsiMate/shared';
import { getSecurityConfig } from '../src/config/config';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// An alert its source fixes on its own (fix: auto) is not resolved by people: not from
// the row, not in a bulk — a bulk with one such alert is refused whole — whatever their
// role. The source's own recovery (a webhook, the API token) still resolves it.

interface AlertListBody {
	data: { alerts: Alert[] };
}

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const auth = () => `Bearer ${jwtToken}`;
const firing = (id: string, fix?: string) => ({
	id,
	alertName: 'Disk almost full',
	summary: 'Disk at 91%',
	tags: { env: 'prod', ...(fix ? { fix } : {}) },
});
const postCustom = (body: Record<string, unknown>) =>
	app.post('/api/v1/alerts/custom').set('Authorization', auth()).send(body);
const resolveAsUser = (id: string) => app.delete(`/api/v1/alerts/${id}`).set('Authorization', auth());
const resolveAsSource = (id: string) => app.delete(`/api/v1/alerts/${id}?api_token=${getSecurityConfig().api_token}`);
const postBulk = (body: object) => app.post('/api/v1/alerts/bulk').set('Authorization', auth()).send(body);
const findIn = async (path: string, id: string): Promise<Alert | undefined> => {
	const res = await app.get(`${path}?limit=500`).set('Authorization', auth());
	return (res.body as AlertListBody).data.alerts.find((a) => a.id === id);
};
const isFiring = async (id: string) => (await findIn('/api/v1/alerts', id)) !== undefined;
const isResolved = async (id: string) => (await findIn('/api/v1/alerts/resolved', id)) !== undefined;

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

afterAll(() => db.close());

beforeEach(() => {
	db.exec('DELETE FROM alerts; DELETE FROM alerts_resolved;');
});

describe('a person cannot resolve an auto-fixed alert', () => {
	test('DELETE /alerts/:id as a signed-in user: 409 for fix auto (any spelling), 200 for manual or none', async () => {
		await postCustom(firing('auto-1', 'auto'));
		await postCustom(firing('auto-2', 'Auto-Fix'));
		await postCustom(firing('manual-1', 'manual'));
		await postCustom(firing('plain-1'));

		for (const id of ['auto-1', 'auto-2']) {
			const res = await resolveAsUser(id);
			expect(res.status).toBe(409);
			expect(res.body).toMatchObject({
				success: false,
				error: 'This alert is fixed automatically; only its source can resolve it',
				autoFixedAlertIds: [id],
			});
			expect(await isFiring(id)).toBe(true);
		}
		expect((await resolveAsUser('manual-1')).status).toBe(200);
		expect((await resolveAsUser('plain-1')).status).toBe(200);
		expect(await isResolved('manual-1')).toBe(true);
		expect(await isResolved('plain-1')).toBe(true);
	});

	test('the source still resolves it: the API token on the same route, and a webhook recovery', async () => {
		await postCustom(firing('auto-src', 'auto'));
		expect((await resolveAsSource('auto-src')).status).toBe(200);
		expect(await isResolved('auto-src')).toBe(true);

		await postCustom(firing('auto-hook', 'auto'));
		const recovered = await postCustom({ ...firing('auto-hook', 'auto'), status: 'resolved' });
		expect(recovered.status).toBe(200);
		expect(await isResolved('auto-hook')).toBe(true);
	});

	test('bulk resolve by ids with one auto-fixed alert is refused whole — nothing is resolved', async () => {
		await postCustom(firing('b-auto', 'auto'));
		await postCustom(firing('b-manual', 'manual'));
		await postCustom(firing('b-plain'));

		const res = await postBulk({ action: 'resolve', ids: ['b-plain', 'b-auto', 'b-manual'] });
		expect(res.status).toBe(409);
		expect(res.body).toMatchObject({ success: false, autoFixedAlertIds: ['b-auto'] });
		for (const id of ['b-auto', 'b-manual', 'b-plain']) expect(await isFiring(id)).toBe(true);

		// Without it, the rest resolve as before.
		const ok = await postBulk({ action: 'resolve', ids: ['b-plain', 'b-manual'] });
		expect(ok.status).toBe(200);
		expect(ok.body.data).toMatchObject({ matched: 2, succeeded: 2, failed: 0 });
		expect(await isFiring('b-auto')).toBe(true);
	});

	test('bulk resolve by query is refused the same way when the query reaches an auto-fixed alert', async () => {
		await postCustom(firing('q-auto', 'auto'));
		await postCustom(firing('q-plain'));
		await postCustom({ ...firing('q-other'), tags: { env: 'staging' } });
		const res = await postBulk({ action: 'resolve', query: { filters: { 'tagKey:env': ['prod'] } } });
		expect(res.status).toBe(409);
		expect(res.body.autoFixedAlertIds).toEqual(['q-auto']);
		expect(await isFiring('q-plain')).toBe(true);
		// Out of the query's reach, an auto-fixed alert does not block it.
		const staging = await postBulk({ action: 'resolve', query: { filters: { 'tagKey:env': ['staging'] } } });
		expect(staging.status).toBe(200);
		expect(staging.body.data).toMatchObject({ matched: 1, succeeded: 1 });
	});

	test('the fix tag is judged as enriched — what the user sees — in both directions', async () => {
		const rule = async (body: Record<string, unknown>) => {
			const res = await app.post('/api/v1/enrichments').set('Authorization', auth()).send(body);
			expect(res.status).toBe(201);
			return res.body.data.id as number;
		};
		const toAuto = await rule({
			name: 'self-healing disks',
			nameContains: 'Enriched Auto',
			addFields: [{ key: 'fix', value: 'auto' }],
		});
		const toManual = await rule({
			name: 'needs hands after all',
			nameContains: 'Enriched Manual',
			addFields: [{ key: 'fix', value: 'manual' }],
		});
		try {
			// Stored without a fix, enriched to auto: refused, singly and in a bulk.
			await postCustom({ ...firing('enr-auto'), alertName: 'Enriched Auto disk' });
			expect((await resolveAsUser('enr-auto')).status).toBe(409);
			const bulk = await postBulk({ action: 'resolve', ids: ['enr-auto'] });
			expect(bulk.status).toBe(409);
			expect(await isFiring('enr-auto')).toBe(true);
			// Stored as auto, enriched to manual: a person may resolve it.
			await postCustom({ ...firing('enr-manual', 'auto'), alertName: 'Enriched Manual disk' });
			expect((await resolveAsUser('enr-manual')).status).toBe(200);
			expect(await isResolved('enr-manual')).toBe(true);
		} finally {
			for (const id of [toAuto, toManual]) {
				await app.delete(`/api/v1/enrichments/${id}`).set('Authorization', auth());
			}
		}
	});

	test('other actions on an auto-fixed alert are untouched: silence, comment, owner', async () => {
		await postCustom(firing('s-auto', 'auto'));
		const silenced = await postBulk({ action: 'silence', ids: ['s-auto'] });
		expect(silenced.status).toBe(200);
		expect(silenced.body.data).toMatchObject({ succeeded: 1 });
		const commented = await postBulk({ action: 'comment', ids: ['s-auto'], comment: 'auto, leave it' });
		expect(commented.status).toBe(200);
		expect(commented.body.data).toMatchObject({ succeeded: 1 });
	});
});
