import { describe, test, expect, beforeAll } from 'vitest';
import { SuperTest, Test } from 'supertest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup.ts';

describe('admin user PATCH validation', () => {
	let app: SuperTest<Test>;
	let adminToken: string;
	let targetUserId: number;

	beforeAll(async () => {
		const db = await setupDB();
		app = await setupExpressApp(db);
		// First registered user is an admin
		adminToken = await setupUserWithToken(app);

		// Create a second user to patch (registration is disabled after the first admin)
		const createRes = await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
			email: 'target@example.com',
			fullName: 'Target User',
			password: 'Password123',
			role: 'viewer',
		});
		expect(createRes.status).toBe(201);
		targetUserId = createRes.body.data.id;
	});

	async function getTargetRole(): Promise<string> {
		const res = await app.get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
		expect(res.status).toBe(200);
		const user = res.body.data.find((u: { id: number }) => u.id === targetUserId);
		return user.role;
	}

	test('PATCH /users/:id with an invalid role returns 400 and leaves the role unchanged', async () => {
		const before = await getTargetRole();
		const res = await app
			.patch(`/api/v1/users/${targetUserId}`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ role: 'superuser' });
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(await getTargetRole()).toBe(before);
	});

	test('PATCH /users/:id with an invalid email returns 400', async () => {
		const res = await app
			.patch(`/api/v1/users/${targetUserId}`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ email: 'not-an-email' });
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	test('PATCH /users/:id with an empty body returns 400', async () => {
		const res = await app
			.patch(`/api/v1/users/${targetUserId}`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({});
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	test('PATCH /users/:id with a valid role returns 200 and changes the role', async () => {
		const res = await app
			.patch(`/api/v1/users/${targetUserId}`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ role: 'editor' });
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(await getTargetRole()).toBe('editor');
	});

	test('PATCH /users/:id/reset-password with a password containing spaces returns 400', async () => {
		const res = await app
			.patch(`/api/v1/users/${targetUserId}/reset-password`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ newPassword: 'has spaces 123' });
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	test('PATCH /users/:id/reset-password with an empty body returns 400', async () => {
		const res = await app
			.patch(`/api/v1/users/${targetUserId}/reset-password`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({});
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	test('PATCH /users/:id/reset-password with a valid password returns 200', async () => {
		const res = await app
			.patch(`/api/v1/users/${targetUserId}/reset-password`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ newPassword: 'NewPassword123' });
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
	});
});
