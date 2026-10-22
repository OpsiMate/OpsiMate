import Database from 'better-sqlite3';
import { SuperTest, Test } from 'supertest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

afterAll(() => {
	db.close();
});

const idRoutes = [
	{ name: 'tags', path: (id: string) => `/api/v1/tags/${id}` },
	{ name: 'dashboards', path: (id: string) => `/api/v1/dashboards/${id}/tags` },
	{ name: 'mute policies', path: (id: string) => `/api/v1/mute-policies/${id}` },
	{ name: 'enrichments', path: (id: string) => `/api/v1/enrichments/${id}` },
	{ name: 'actions', path: (id: string) => `/api/v1/actions/${id}` },
	{ name: 'custom fields', path: (id: string) => `/api/v1/custom-fields/${id}` },
];

describe('numeric path parameters', () => {
	test.each(idRoutes)('$name rejects malformed IDs', async ({ path }) => {
		for (const id of ['abc', '12abc']) {
			const response = await app.get(path(id)).set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(400);
			expect((response.body as { success: boolean }).success).toBe(false);
		}
	});
});

interface ApiResponse {
	success: boolean;
	error?: string;
}

interface UserRow {
	id: number;
	email: string;
}

interface UserResponse {
	data: UserRow;
}

interface UserListResponse {
	data: UserRow[];
}

type WriteMethod = 'delete' | 'patch' | 'put';

interface WriteIdRoute {
	name: string;
	method: WriteMethod;
	path: (id: string) => string;
	error: string;
}

const writeIdRoutes: WriteIdRoute[] = [
	{ name: 'DELETE /users/:id', method: 'delete', path: (id) => `/api/v1/users/${id}`, error: 'Invalid user ID' },
	{
		name: 'PATCH /users/:id/reset-password',
		method: 'patch',
		path: (id) => `/api/v1/users/${id}/reset-password`,
		error: 'Invalid user ID',
	},
	{ name: 'PATCH /users/:id', method: 'patch', path: (id) => `/api/v1/users/${id}`, error: 'Invalid user ID' },
	{
		name: 'PATCH /oncall/teams/:teamId',
		method: 'patch',
		path: (id) => `/api/v1/oncall/teams/${id}`,
		error: 'Invalid team id',
	},
	{
		name: 'DELETE /oncall/teams/:teamId',
		method: 'delete',
		path: (id) => `/api/v1/oncall/teams/${id}`,
		error: 'Invalid team id',
	},
	{
		name: 'PUT /oncall/teams/:teamId/members',
		method: 'put',
		path: (id) => `/api/v1/oncall/teams/${id}/members`,
		error: 'Invalid team id',
	},
	{
		name: 'PUT /integrations/:integrationId',
		method: 'put',
		path: (id) => `/api/v1/integrations/${id}`,
		error: 'Invalid integration ID',
	},
	{
		name: 'DELETE /integrations/:integrationId',
		method: 'delete',
		path: (id) => `/api/v1/integrations/${id}`,
		error: 'Invalid integration ID',
	},
	{ name: 'PUT /secrets/:id', method: 'put', path: (id) => `/api/v1/secrets/${id}`, error: 'Invalid secret ID' },
	{
		name: 'DELETE /secrets/:id',
		method: 'delete',
		path: (id) => `/api/v1/secrets/${id}`,
		error: 'Invalid secret ID',
	},
];

describe('numeric path parameters on write routes', () => {
	test.each(writeIdRoutes)('$name rejects malformed IDs', async ({ method, path, error }) => {
		for (const id of ['2abc', '1.5', '0', '-1']) {
			const response = await app[method](path(id)).set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(400);
			const body = response.body as ApiResponse;
			expect(body.success).toBe(false);
			expect(body.error).toBe(error);
		}
	});

	test('DELETE /users/<id>abc does not delete the real user', async () => {
		const created = await app
			.post('/api/v1/users')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ email: 'keep-me@example.com', fullName: 'Keep Me', password: 'secret123', role: 'viewer' });
		expect(created.status).toBe(201);
		const userId = (created.body as UserResponse).data.id;

		const response = await app.delete(`/api/v1/users/${userId}abc`).set('Authorization', `Bearer ${jwtToken}`);
		expect(response.status).toBe(400);

		const list = await app.get('/api/v1/users').set('Authorization', `Bearer ${jwtToken}`);
		const ids = (list.body as UserListResponse).data.map((user) => user.id);
		expect(ids).toContain(userId);
	});

	test.each(['/api/v1/users/999999', '/api/v1/integrations/999999', '/api/v1/secrets/999999'])(
		'DELETE %s passes id validation and answers 404',
		async (path) => {
			const response = await app.delete(path).set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(404);
		}
	);
});
