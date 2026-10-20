import Database from 'better-sqlite3';
import { SuperTest, Test } from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// GET /alerts/owners: the id -> name map a client outside the UI needs to show owners,
// readable by any authenticated user (the owner facet already shows the names).
describe('GET /api/v1/alerts/owners', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let token: string;

	beforeAll(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		token = await setupUserWithToken(app);
	});

	afterAll(() => db.close());

	test('lists users as id + fullName, and needs credentials', async () => {
		const res = await app.get('/api/v1/alerts/owners').set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(200);
		expect(res.body.data).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: expect.any(String), fullName: expect.any(String) })])
		);
		expect(JSON.stringify(res.body.data)).not.toContain('@');
		expect((await app.get('/api/v1/alerts/owners')).status).toBe(401);
	});
});
