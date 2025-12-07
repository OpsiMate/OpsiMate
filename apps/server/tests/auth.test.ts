import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp } from './setup.ts';

describe('Authentication API', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;

	beforeAll(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
	});

	beforeEach(() => {
		db.exec('DELETE FROM users');
	});

	afterAll(() => {
		db.close();
	});

	test('should register a new admin user and return a JWT token', async () => {
		const res = await app.post('/api/v1/users/register').send({
			email: 'admin@example.com',
			fullName: 'Admin User',
			password: 'securepassword',
		});
		expect(res.status).toBe(201);
		expect(res.body.success).toBe(true);
		expect(res.body.data.email).toBe('admin@example.com');
		expect(res.body.data.role).toBe('admin');
		expect(typeof res.body.token).toBe('string');
	});

	test('should login with registered user and return a JWT token', async () => {
		// Register first
		await app.post('/api/v1/users/register').send({
			email: 'loginuser@example.com',
			fullName: 'Login User',
			password: 'securepassword',
		});
		// Login
		const res = await app.post('/api/v1/users/login').send({
			email: 'loginuser@example.com',
			password: 'securepassword',
		});
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.email).toBe('loginuser@example.com');
		expect(typeof res.body.token).toBe('string');
	});

	test('should reject login with wrong password', async () => {
		// Register first
		await app.post('/api/v1/users/register').send({
			email: 'wrongpass@example.com',
			fullName: 'Wrong Pass',
			password: 'securepassword',
		});
		// Wrong password
		const res = await app.post('/api/v1/users/login').send({
			email: 'wrongpass@example.com',
			password: 'wrongpassword',
		});
		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	test('should reject access to protected endpoint without JWT', async () => {
		const res = await app.get('/api/v1/alerts');
		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	test('should allow access to protected endpoint with valid JWT', async () => {
		// Register and login
		await app.post('/api/v1/users/register').send({
			email: 'protected@example.com',
			fullName: 'Protected User',
			password: 'securepassword',
		});
		const loginRes = await app.post('/api/v1/users/login').send({
			email: 'protected@example.com',
			password: 'securepassword',
		});
		const token = loginRes.body.token;
		const res = await app.get('/api/v1/alerts').set('Authorization', `Bearer ${token}`);
		// 200 is expected, but if no alerts table, could be 500
		expect(res.status).toBe(200);
	});

	test('should get all users as admin, reject for non-admin or unauthenticated', async () => {
		// Register admin
		await app.post('/api/v1/users/register').send({
			email: 'admin2@example.com',
			fullName: 'Admin2 User',
			password: 'securepassword',
		});
		// Login as admin
		const loginRes = await app.post('/api/v1/users/login').send({
			email: 'admin2@example.com',
			password: 'securepassword',
		});
		const adminToken = loginRes.body.token;

		// Admin can get all users
		const res = await app.get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(Array.isArray(res.body.data)).toBe(true);
		expect(res.body.data[0]).toMatchObject({
			email: 'admin2@example.com',
			fullName: 'Admin2 User',
			role: 'admin',
		});

		// Unauthenticated request
		const unauthRes = await app.get('/api/v1/users');
		expect(unauthRes.status).toBe(401);
		expect(unauthRes.body.success).toBe(false);

		// Register a non-admin user (admin creates them)
		await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
			email: 'viewer@example.com',
			fullName: 'Viewer User',
			password: 'securepassword',
			role: 'viewer',
		});
		// Login as viewer
		const viewerLogin = await app.post('/api/v1/users/login').send({
			email: 'viewer@example.com',
			password: 'securepassword',
		});
		const viewerToken = viewerLogin.body.token;
		// Viewer should get 403
		const viewerRes = await app.get('/api/v1/users').set('Authorization', `Bearer ${viewerToken}`);
		expect(viewerRes.status).toBe(403);
		expect(viewerRes.body.success).toBe(false);
	});

	test('should return false for /users/exists when no users exist, and true after registration', async () => {
		// Initially, no users
		let res = await app.get('/api/v1/users/exists');
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.exists).toBe(false);

		// Register a user
		await app.post('/api/v1/users/register').send({
			email: 'exists@example.com',
			fullName: 'Exists User',
			password: 'securepassword',
		});

		// Now, users exist
		res = await app.get('/api/v1/users/exists');
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.exists).toBe(true);
	});

	test('admin can delete a user', async () => {
		// Register admin
		await app.post('/api/v1/users/register').send({
			email: 'admin3@example.com',
			fullName: 'Admin3 User',
			password: 'securepassword',
		});
		// Login as admin
		const loginRes = await app.post('/api/v1/users/login').send({
			email: 'admin3@example.com',
			password: 'securepassword',
		});
		const adminToken = loginRes.body.token;
		// Admin creates a viewer
		const createRes = await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
			email: 'deleteuser@example.com',
			fullName: 'Delete User',
			password: 'securepassword',
			role: 'viewer',
		});
		const userId = createRes.body.data.id;
		// Admin deletes the user
		const delRes = await app.delete(`/api/v1/users/${userId}`).set('Authorization', `Bearer ${adminToken}`);
		expect(delRes.status).toBe(200);
		expect(delRes.body.success).toBe(true);
		// User should not be in list
		const usersRes = await app.get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
		expect(usersRes.body.data.find((u: any) => u.id === userId)).toBeUndefined();
	});

	test('non-admin cannot delete a user', async () => {
		// Register admin and viewer
		await app.post('/api/v1/users/register').send({
			email: 'admin4@example.com',
			fullName: 'Admin4 User',
			password: 'securepassword',
		});
		const adminLogin = await app.post('/api/v1/users/login').send({
			email: 'admin4@example.com',
			password: 'securepassword',
		});
		const adminToken = adminLogin.body.token;
		await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
			email: 'viewer2@example.com',
			fullName: 'Viewer2 User',
			password: 'securepassword',
			role: 'viewer',
		});
		const viewerLogin = await app.post('/api/v1/users/login').send({
			email: 'viewer2@example.com',
			password: 'securepassword',
		});
		const viewerToken = viewerLogin.body.token;
		// Viewer tries to delete admin
		const res = await app.delete('/api/v1/users/1').set('Authorization', `Bearer ${viewerToken}`);
		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);
	});

	test('deleting non-existent user returns 404', async () => {
		// Register admin
		await app.post('/api/v1/users/register').send({
			email: 'admin6@example.com',
			fullName: 'Admin6 User',
			password: 'securepassword',
		});
		const loginRes = await app.post('/api/v1/users/login').send({
			email: 'admin6@example.com',
			password: 'securepassword',
		});
		const adminToken = loginRes.body.token;
		// Try to delete non-existent user
		const res = await app.delete('/api/v1/users/9999').set('Authorization', `Bearer ${adminToken}`);
		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	test('should return 401 for invalid token', async () => {
		const response = await app.get('/api/v1/alerts').set('Authorization', 'Bearer invalid-token');

		expect(response.status).toBe(401);
		expect(response.body.success).toBe(false);
	});

	test('should update user profile successfully', async () => {
		// Register user first
		await app.post('/api/v1/users/register').send({
			email: 'admin@example.com',
			fullName: 'Admin User',
			password: 'password123',
		});

		const loginResponse = await app.post('/api/v1/users/login').send({
			email: 'admin@example.com',
			password: 'password123',
		});

		expect(loginResponse.status).toBe(200);
		const token = loginResponse.body.token;

		const updateResponse = await app.patch('/api/v1/users/profile').set('Authorization', `Bearer ${token}`).send({
			fullName: 'Updated Admin Name',
			newPassword: 'newpassword123',
		});

		expect(updateResponse.status).toBe(200);
		expect(updateResponse.body.success).toBe(true);
		expect(updateResponse.body.data.user.fullName).toBe('Updated Admin Name');
		expect(updateResponse.body.data.token).toBeDefined();

		// Verify we can login with new password
		const newLoginResponse = await app.post('/api/v1/users/login').send({
			email: 'admin@example.com',
			password: 'newpassword123',
		});

		expect(newLoginResponse.status).toBe(200);
	});

	test('should update user profile without password change', async () => {
		// Register user first
		await app.post('/api/v1/users/register').send({
			email: 'admin@example.com',
			fullName: 'Admin User',
			password: 'password123',
		});

		const loginResponse = await app.post('/api/v1/users/login').send({
			email: 'admin@example.com',
			password: 'password123',
		});

		expect(loginResponse.status).toBe(200);
		const token = loginResponse.body.token;

		const updateResponse = await app.patch('/api/v1/users/profile').set('Authorization', `Bearer ${token}`).send({
			fullName: 'Another Updated Name',
		});

		expect(updateResponse.status).toBe(200);
		expect(updateResponse.body.success).toBe(true);
		expect(updateResponse.body.data.user.fullName).toBe('Another Updated Name');
		expect(updateResponse.body.data.token).toBeUndefined();
	});

	test('should return 400 for invalid profile update data', async () => {
		// Register user first
		await app.post('/api/v1/users/register').send({
			email: 'admin@example.com',
			fullName: 'Admin User',
			password: 'password123',
		});

		const loginResponse = await app.post('/api/v1/users/login').send({
			email: 'admin@example.com',
			password: 'password123',
		});

		expect(loginResponse.status).toBe(200);
		const token = loginResponse.body.token;

		const updateResponse = await app.patch('/api/v1/users/profile').set('Authorization', `Bearer ${token}`).send({
			fullName: '', // Invalid: empty name
			newPassword: 'short', // Invalid: too short
		});

		expect(updateResponse.status).toBe(400);
		expect(updateResponse.body.success).toBe(false);
		expect(updateResponse.body.error).toBe('Validation error');
	});

	test('should return 401 for profile update without authentication', async () => {
		const updateResponse = await app.patch('/api/v1/users/profile').send({
			fullName: 'Test Name',
		});

		expect(updateResponse.status).toBe(401);
		expect(updateResponse.body.success).toBe(false);
		expect(updateResponse.body.error).toBe('Missing Authorization header or API token');
	});

	describe('Role-based access control for edit methods', () => {
		test('should allow admin and editor to access POST-like requests, but block viewer', async () => {
			// Register admin user (first user is automatically admin)
			const adminRes = await app.post('/api/v1/users/register').send({
				email: 'rbac-admin@test.com',
				fullName: 'RBAC Admin',
				password: 'password123',
			});
			const adminToken = adminRes.body.token;

			// Create editor user using createUserHandler
			await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
				email: 'rbac-editor@test.com',
				fullName: 'RBAC Editor',
				password: 'password123',
				role: 'editor',
			});

			// Create viewer user using createUserHandler
			await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
				email: 'rbac-viewer@test.com',
				fullName: 'RBAC Viewer',
				password: 'password123',
				role: 'viewer',
			});

			// Get tokens for all users
			const editorLoginRes = await app.post('/api/v1/users/login').send({
				email: 'rbac-editor@test.com',
				password: 'password123',
			});
			const editorToken = editorLoginRes.body.token;

			const viewerLoginRes = await app.post('/api/v1/users/login').send({
				email: 'rbac-viewer@test.com',
				password: 'password123',
			});
			const viewerToken = viewerLoginRes.body.token;

			// Test edit methods that should be restricted for viewers
			const testEndpoint = '/api/v1/providers';
			const testData = { name: 'test-provider', type: 'ssh', host: 'test.com' };

			const adminResponse = await app
				.post(testEndpoint)
				.set('Authorization', `Bearer ${adminToken}`)
				.send(testData);

			// Admin should not be blocked by role restriction
			expect(adminResponse.status).not.toBe(403);

			// Test editor access (should not be blocked by role)
			const editorResponse = await app
				.post(testEndpoint)
				.set('Authorization', `Bearer ${editorToken}`)
				.send(testData);

			// Editor should not be blocked by role restriction
			expect(editorResponse.status).not.toBe(403);

			// Test viewer access (should be blocked)
			const viewerResponse = await app
				.post(testEndpoint)
				.set('Authorization', `Bearer ${viewerToken}`)
				.send(testData);

			// Viewer should be blocked with 403 and specific error message
			expect(viewerResponse.status).toBe(403);
			expect(viewerResponse.body.success).toBe(false);

			// GET requests should work for all roles, including viewer
			const readResponse = await app.get('/api/v1/providers').set('Authorization', `Bearer ${viewerToken}`);

			// Should not be blocked by role restriction (may get other status codes like 200, 404, etc.)
			expect(readResponse.status).not.toBe(403);
		});
	});
});
