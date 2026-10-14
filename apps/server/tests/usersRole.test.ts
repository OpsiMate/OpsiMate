import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup.ts';

interface UserSummary {
	email: string;
	role: string;
}

describe('PATCH /users/role', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let adminToken: string;

	beforeAll(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		// First registered user is an admin
		adminToken = await setupUserWithToken(app);
	});

	afterAll(() => {
		db.close();
	});

	test('an email that does not exist returns 404', async () => {
		const res = await app
			.patch('/api/v1/users/role')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ email: 'nobody@example.com', newRole: 'viewer' });
		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
		expect(res.body.error).toBe('User not found');
	});

	test('an existing user returns 200 and the role is changed', async () => {
		const createRes = await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
			email: 'target@example.com',
			fullName: 'Target User',
			password: 'Password123',
			role: 'viewer',
		});
		expect(createRes.status).toBe(201);

		const res = await app
			.patch('/api/v1/users/role')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ email: 'target@example.com', newRole: 'editor' });
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);

		const listRes = await app.get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
		const user = listRes.body.data.find((u: UserSummary) => u.email === 'target@example.com');
		expect(user.role).toBe('editor');
	});

	test('an invalid newRole returns 400', async () => {
		const res = await app
			.patch('/api/v1/users/role')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ email: 'target@example.com', newRole: 'superuser' });
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});
});
