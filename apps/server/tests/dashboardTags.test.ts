import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;
let dashboardId: number;
let tagId: number;
let fixtureNumber = 0;

const authorized = () => ({ Authorization: `Bearer ${jwtToken}` });

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

beforeEach(async () => {
	fixtureNumber += 1;
	const dashboard = await app
		.post('/api/v1/dashboards')
		.set(authorized())
		.send({
			name: `Tag test dashboard ${fixtureNumber}`,
			type: 'alerts',
			description: '',
			filters: {},
			visibleColumns: ['alertName'],
			query: '',
			groupBy: [],
		});
	const tag = await app
		.post('/api/v1/tags')
		.set(authorized())
		.send({ name: `Dashboard tag ${fixtureNumber}`, color: '#3366FF' });

	expect(dashboard.status).toBe(200);
	expect(tag.status).toBe(201);
	dashboardId = dashboard.body.data.id;
	tagId = tag.body.data.id;
});

afterAll(() => {
	db.close();
});

describe('Dashboard Tags API', () => {
	test('returns not found when adding a tag to an unknown dashboard', async () => {
		const response = await app.post('/api/v1/dashboards/999999/tags').set(authorized()).send({ tagId });

		expect(response.status).toBe(404);
		expect(response.body).toEqual({ success: false, error: 'Dashboard not found' });
	});

	test('returns not found when adding an unknown tag', async () => {
		const response = await app
			.post(`/api/v1/dashboards/${dashboardId}/tags`)
			.set(authorized())
			.send({ tagId: 999999 });

		expect(response.status).toBe(404);
		expect(response.body).toEqual({ success: false, error: 'Tag with ID 999999 not found' });
	});

	test('adds, lists, and idempotently removes a dashboard tag', async () => {
		const add = await app.post(`/api/v1/dashboards/${dashboardId}/tags`).set(authorized()).send({ tagId });
		expect(add.status).toBe(200);

		const list = await app.get(`/api/v1/dashboards/${dashboardId}/tags`).set(authorized());
		expect(list.status).toBe(200);
		expect(list.body.data).toHaveLength(1);
		expect(list.body.data[0]).toEqual(
			expect.objectContaining({ id: tagId, name: `Dashboard tag ${fixtureNumber}`, color: '#3366FF' })
		);

		const remove = await app.delete(`/api/v1/dashboards/${dashboardId}/tags/${tagId}`).set(authorized());
		const removeAgain = await app.delete(`/api/v1/dashboards/${dashboardId}/tags/${tagId}`).set(authorized());

		expect(remove.status).toBe(200);
		expect(removeAgain.status).toBe(200);
		const afterRemoval = await app.get(`/api/v1/dashboards/${dashboardId}/tags`).set(authorized());
		expect(afterRemoval.body.data).toEqual([]);
	});

	test('aggregates tags by dashboard', async () => {
		const secondDashboard = await app
			.post('/api/v1/dashboards')
			.set(authorized())
			.send({
				name: `Second tag test dashboard ${fixtureNumber}`,
				type: 'alerts',
				description: '',
				filters: {},
				visibleColumns: ['alertName'],
				query: '',
				groupBy: [],
			});
		const secondTag = await app
			.post('/api/v1/tags')
			.set(authorized())
			.send({ name: `Second dashboard tag ${fixtureNumber}`, color: '#22AA66' });

		expect(secondDashboard.status).toBe(200);
		expect(secondTag.status).toBe(201);
		const secondDashboardId = secondDashboard.body.data.id;
		const secondTagId = secondTag.body.data.id;

		await app.post(`/api/v1/dashboards/${dashboardId}/tags`).set(authorized()).send({ tagId });
		await app.post(`/api/v1/dashboards/${secondDashboardId}/tags`).set(authorized()).send({ tagId: secondTagId });

		const response = await app.get('/api/v1/dashboards/tags').set(authorized());

		expect(response.status).toBe(200);
		const dashboard = response.body.data.find((item: { dashboardId: number }) => item.dashboardId === dashboardId);
		const secondDashboardGroup = response.body.data.find(
			(item: { dashboardId: number }) => item.dashboardId === secondDashboardId
		);
		expect(dashboard.tags).toHaveLength(1);
		expect(dashboard.tags[0]).toEqual(
			expect.objectContaining({ id: tagId, name: `Dashboard tag ${fixtureNumber}`, color: '#3366FF' })
		);
		expect(secondDashboardGroup.tags).toHaveLength(1);
		expect(secondDashboardGroup.tags[0]).toEqual(
			expect.objectContaining({
				id: secondTagId,
				name: `Second dashboard tag ${fixtureNumber}`,
				color: '#22AA66',
			})
		);
	});
});
