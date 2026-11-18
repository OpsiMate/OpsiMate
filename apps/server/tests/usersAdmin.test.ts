import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { Role, User } from '@OpsiMate/shared';
import { setupDB, setupExpressApp } from './setup.ts';

interface PartialUpdateCase {
	field: string;
	changes: Partial<Pick<User, 'fullName' | 'email' | 'role'>>;
}

const originalPassword = 'OriginalPassword123';
const replacementPassword = 'ReplacementPassword456';
const adminEmail = 'admin@users-admin.test';
const targetEmail = 'target@users-admin.test';

const partialUpdates: PartialUpdateCase[] = [
	{ field: 'fullName', changes: { fullName: 'Renamed Target' } },
	{ field: 'email', changes: { email: 'renamed@users-admin.test' } },
	{ field: 'role', changes: { role: Role.Editor } },
];

describe('admin user management endpoint behavior', () => {
	let app: SuperTest<Test>;
	let db: Database.Database | undefined;
	let adminToken: string;
	let admin: User;
	let target: User;

	beforeEach(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		const registration = await app.post('/api/v1/users/register').send({
			email: adminEmail,
			fullName: 'Admin User',
			password: originalPassword,
		});
		expect(registration.status).toBe(201);
		expect(registration.body.data.role).toBe(Role.Admin);
		admin = registration.body.data;
		adminToken = registration.body.token;
		expect(adminToken).toEqual(expect.any(String));

		const creation = await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
			email: targetEmail,
			fullName: 'Target User',
			password: originalPassword,
			role: Role.Viewer,
		});
		expect(creation.status).toBe(201);
		target = creation.body.data;
	});

	afterEach(() => {
		db?.close();
	});

	async function listUsers(): Promise<User[]> {
		const response = await app.get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
		expect(response.status).toBe(200);
		const users: User[] = response.body.data;
		return users;
	}

	async function expectOriginalPasswordStillWorks(user: User): Promise<void> {
		const login = await app.post('/api/v1/users/login').send({ email: user.email, password: originalPassword });
		expect(login.status).toBe(200);
		expect(login.body.data.id).toBe(user.id);
		expect(login.body.token).toEqual(expect.any(String));
	}

	test('a non-numeric update id returns 400 without modifying users', async () => {
		const before = await listUsers();
		const response = await app
			.patch('/api/v1/users/not-a-number')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ fullName: 'Must Not Be Saved' });
		expect(response.status).toBe(400);
		expect(response.body).toEqual({ success: false, error: 'Invalid user ID' });
		expect(await listUsers()).toEqual(before);
	});

	test('an unknown update id returns 404 without modifying users', async () => {
		const before = await listUsers();
		const response = await app
			.patch('/api/v1/users/999999')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ fullName: 'Must Not Be Saved' });
		expect(response.status).toBe(404);
		expect(response.body).toEqual({ success: false, error: 'User not found' });
		expect(await listUsers()).toEqual(before);
	});

	test('an empty update reports the missing-field validation message without modifying users', async () => {
		const before = await listUsers();
		const response = await app
			.patch(`/api/v1/users/${target.id}`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({});
		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({
			success: false,
			error: 'Validation error',
			details: expect.arrayContaining([
				expect.objectContaining({ message: 'At least one field (fullName, email, or role) must be provided' }),
			]),
		});
		expect(await listUsers()).toEqual(before);
	});

	test('an email belonging to another user returns 400 and preserves both accounts', async () => {
		const before = await listUsers();
		const response = await app
			.patch(`/api/v1/users/${target.id}`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ email: admin.email });
		expect(response.status).toBe(400);
		expect(response.body).toEqual({ success: false, error: 'Email already registered' });
		expect(await listUsers()).toEqual(before);
		await expectOriginalPasswordStillWorks(target);
	});

	test.each(partialUpdates)(
		'updating only $field preserves every other field and the password',
		async ({ changes }) => {
			const before = await listUsers();
			const response = await app
				.patch(`/api/v1/users/${target.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send(changes);
			expect(response.status).toBe(200);
			const expected = { ...target, ...changes };
			expect(response.body).toMatchObject({
				success: true,
				data: expected,
				message: 'User updated successfully',
			});
			expect(await listUsers()).toEqual(
				before.map((user) => (user.id === target.id ? { ...user, ...changes } : user))
			);
			await expectOriginalPasswordStillWorks(expected);
		}
	);

	test('a password shorter than eight characters returns 400 and leaves the old password valid', async () => {
		const response = await app
			.patch(`/api/v1/users/${target.id}/reset-password`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ newPassword: 'short12' });
		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({
			success: false,
			error: 'Validation error',
			details: expect.arrayContaining([
				expect.objectContaining({ message: 'Password must be at least 8 characters' }),
			]),
		});
		await expectOriginalPasswordStillWorks(target);
	});

	test('the admin cannot reset their own password through the admin endpoint', async () => {
		const response = await app
			.patch(`/api/v1/users/${admin.id}/reset-password`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ newPassword: replacementPassword });
		expect(response.status).toBe(400);
		expect(response.body).toEqual({
			success: false,
			error: 'Cannot reset your own password. Use profile settings instead.',
		});
		await expectOriginalPasswordStillWorks(admin);
	});

	test('resetting an unknown user returns 404 and leaves existing passwords valid', async () => {
		const response = await app
			.patch('/api/v1/users/999999/reset-password')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ newPassword: replacementPassword });
		expect(response.status).toBe(404);
		expect(response.body).toEqual({ success: false, error: 'User not found' });
		await expectOriginalPasswordStillWorks(target);
		await expectOriginalPasswordStillWorks(admin);
	});

	test('a successful reset replaces the target password without changing their profile or the admin password', async () => {
		const before = await listUsers();
		const response = await app
			.patch(`/api/v1/users/${target.id}/reset-password`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ newPassword: replacementPassword });
		expect(response.status).toBe(200);
		expect(response.body).toEqual({ success: true, message: 'Password reset successfully' });
		expect(await listUsers()).toEqual(before);

		const oldLogin = await app
			.post('/api/v1/users/login')
			.send({ email: target.email, password: originalPassword });
		expect(oldLogin.status).toBe(401);
		expect(oldLogin.body.success).toBe(false);
		expect(oldLogin.body.token).toBeUndefined();
		const newLogin = await app
			.post('/api/v1/users/login')
			.send({ email: target.email, password: replacementPassword });
		expect(newLogin.status).toBe(200);
		expect(newLogin.body).toMatchObject({ success: true, data: target, token: expect.any(String) });
		await expectOriginalPasswordStillWorks(admin);
	});

	test('a second public registration returns 403 and does not create another account', async () => {
		const before = await listUsers();
		const response = await app.post('/api/v1/users/register').send({
			email: 'second-admin@users-admin.test',
			fullName: 'Must Not Be Created',
			password: originalPassword,
		});
		expect(response.status).toBe(403);
		expect(response.body).toEqual({ success: false, error: 'Registration is disabled after first admin' });
		expect(response.body.token).toBeUndefined();
		expect(await listUsers()).toEqual(before);
	});
});
