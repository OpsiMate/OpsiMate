import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { expect } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const UNKNOWN_ID = 999999;

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

afterAll(() => {
	db.close();
});

// Both resources expose the same GET/PUT/DELETE /:id contract, so one table-driven
// suite covers them. Each case creates its own row through the API so the test does
// not depend on the table layout.
const resources = [
	{
		name: 'mute policies',
		basePath: '/api/v1/mute-policies',
		table: 'alert_mute_policies',
		notFoundError: 'Mute policy not found',
		createBody: { name: 'Maintenance window', nameContains: 'CPU', reason: 'Planned maintenance' },
		updateBody: { name: 'Maintenance window (extended)', reason: 'Extended maintenance' },
	},
	{
		name: 'enrichments',
		basePath: '/api/v1/enrichments',
		table: 'alert_enrichments',
		notFoundError: 'Enrichment not found',
		createBody: {
			name: 'Owner enrichment',
			nameContains: 'CPU',
			addFields: [{ key: 'owner', value: 'platform' }],
			priority: 5,
		},
		updateBody: { name: 'Owner enrichment (renamed)', priority: 7 },
	},
];

describe.each(resources)('$name by id', ({ basePath, table, notFoundError, createBody, updateBody }) => {
	let id: number;

	beforeEach(async () => {
		db.exec(`DELETE FROM ${table}`);
		const createRes = await app.post(basePath).set('Authorization', `Bearer ${jwtToken}`).send(createBody);
		expect(createRes.status).toBe(201);
		id = createRes.body.data.id as number;
	});

	test('GET returns an existing resource', async () => {
		const res = await app.get(`${basePath}/${id}`).set('Authorization', `Bearer ${jwtToken}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.id).toBe(id);
		expect(res.body.data.name).toBe(createBody.name);
	});

	test('GET, PUT and DELETE return 404 for an unknown id', async () => {
		const getRes = await app.get(`${basePath}/${UNKNOWN_ID}`).set('Authorization', `Bearer ${jwtToken}`);
		const putRes = await app
			.put(`${basePath}/${UNKNOWN_ID}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(updateBody);
		const deleteRes = await app.delete(`${basePath}/${UNKNOWN_ID}`).set('Authorization', `Bearer ${jwtToken}`);

		for (const res of [getRes, putRes, deleteRes]) {
			expect(res.status).toBe(404);
			expect(res.body.success).toBe(false);
			expect(res.body.error).toBe(notFoundError);
		}

		// The existing row is untouched.
		const existing = await app.get(`${basePath}/${id}`).set('Authorization', `Bearer ${jwtToken}`);
		expect(existing.status).toBe(200);
		expect(existing.body.data.name).toBe(createBody.name);
	});

	test('GET, PUT and DELETE return 400 for a non-numeric id', async () => {
		const getRes = await app.get(`${basePath}/abc`).set('Authorization', `Bearer ${jwtToken}`);
		const putRes = await app.put(`${basePath}/abc`).set('Authorization', `Bearer ${jwtToken}`).send(updateBody);
		const deleteRes = await app.delete(`${basePath}/abc`).set('Authorization', `Bearer ${jwtToken}`);

		for (const res of [getRes, putRes, deleteRes]) {
			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
			expect(res.body.error).toBe('Validation error');
		}
	});

	test('GET, PUT and DELETE return 401 without an Authorization header', async () => {
		const getRes = await app.get(`${basePath}/${id}`);
		const putRes = await app.put(`${basePath}/${id}`).send(updateBody);
		const deleteRes = await app.delete(`${basePath}/${id}`);

		for (const res of [getRes, putRes, deleteRes]) {
			expect(res.status).toBe(401);
		}

		// Nothing was changed or removed by the unauthenticated requests.
		const existing = await app.get(`${basePath}/${id}`).set('Authorization', `Bearer ${jwtToken}`);
		expect(existing.status).toBe(200);
		expect(existing.body.data.name).toBe(createBody.name);
	});

	test('PUT with an empty body returns the resource unchanged', async () => {
		const before = await app.get(`${basePath}/${id}`).set('Authorization', `Bearer ${jwtToken}`);
		expect(before.status).toBe(200);

		const putRes = await app.put(`${basePath}/${id}`).set('Authorization', `Bearer ${jwtToken}`).send({});

		expect(putRes.status).toBe(200);
		expect(putRes.body.success).toBe(true);
		const { updatedAt: _ignoredPut, ...putData } = putRes.body.data;
		const { updatedAt: _ignoredBefore, ...beforeData } = before.body.data;
		expect(putData).toEqual(beforeData);
	});

	test('PUT updates the resource', async () => {
		const putRes = await app.put(`${basePath}/${id}`).set('Authorization', `Bearer ${jwtToken}`).send(updateBody);

		expect(putRes.status).toBe(200);
		expect(putRes.body.success).toBe(true);
		expect(putRes.body.data).toMatchObject(updateBody);

		const getRes = await app.get(`${basePath}/${id}`).set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.body.data).toMatchObject(updateBody);
	});

	test('DELETE removes the resource', async () => {
		const deleteRes = await app.delete(`${basePath}/${id}`).set('Authorization', `Bearer ${jwtToken}`);

		expect(deleteRes.status).toBe(200);
		expect(deleteRes.body.success).toBe(true);

		const getRes = await app.get(`${basePath}/${id}`).set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(404);
		expect(getRes.body.error).toBe(notFoundError);
	});
});
