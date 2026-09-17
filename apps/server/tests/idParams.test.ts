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
