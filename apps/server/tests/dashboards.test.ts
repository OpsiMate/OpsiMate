import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
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

describe('Dashboards API — column order persistence', () => {
	test('create and update round-trip columnOrder', async () => {
		const base = {
			name: 'order test',
			type: 'alerts' as const,
			description: '',
			filters: {},
			visibleColumns: ['type', 'alertName', 'summary'],
			columnOrder: ['type', 'alertName', 'summary', 'owner'],
			query: '',
			groupBy: [],
		};
		const created = await app.post('/api/v1/dashboards').set('Authorization', `Bearer ${jwtToken}`).send(base);
		expect(created.status).toBe(200);
		const id = String(created.body.data.id);

		const listById = async () => {
			const list = await app.get('/api/v1/dashboards').set('Authorization', `Bearer ${jwtToken}`);
			return (list.body.data as { id: string | number; columnOrder?: string[] }[]).find(
				(d) => String(d.id) === id
			);
		};
		expect((await listById())?.columnOrder).toEqual(['type', 'alertName', 'summary', 'owner']);

		const updated = await app
			.put(`/api/v1/dashboards/${id}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ ...base, columnOrder: ['alertName', 'type', 'summary', 'owner'] });
		expect(updated.status).toBe(200);
		expect((await listById())?.columnOrder).toEqual(['alertName', 'type', 'summary', 'owner']);
	});

	test('a dashboard saved without columnOrder returns it as undefined', async () => {
		const created = await app
			.post('/api/v1/dashboards')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				name: 'legacy dashboard',
				type: 'alerts',
				description: '',
				filters: {},
				visibleColumns: ['type'],
				query: '',
				groupBy: [],
			});
		expect(created.status).toBe(200);
		const list = await app.get('/api/v1/dashboards').set('Authorization', `Bearer ${jwtToken}`);
		const legacy = (list.body.data as { id: string | number; name: string; columnOrder?: string[] }[]).find(
			(d) => d.name === 'legacy dashboard'
		);
		expect(legacy?.columnOrder).toBeUndefined();
	});
});
