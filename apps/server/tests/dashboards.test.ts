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

	test('create and update round-trip columnWidths; absent means undefined', async () => {
		const base = {
			name: 'widths test',
			type: 'alerts' as const,
			description: '',
			filters: {},
			visibleColumns: ['type', 'alertName', 'summary'],
			columnWidths: { alertName: 320, 'tagKey:env': 180 },
			query: '',
			groupBy: [],
		};
		const created = await app.post('/api/v1/dashboards').set('Authorization', `Bearer ${jwtToken}`).send(base);
		expect(created.status).toBe(200);
		const id = String(created.body.data.id);

		const listById = async () => {
			const list = await app.get('/api/v1/dashboards').set('Authorization', `Bearer ${jwtToken}`);
			return (list.body.data as { id: string | number; columnWidths?: Record<string, number> }[]).find(
				(d) => String(d.id) === id
			);
		};
		expect((await listById())?.columnWidths).toEqual({ alertName: 320, 'tagKey:env': 180 });

		// Update replaces the whole map; an update WITHOUT the field clears it (the
		// client always sends the current map, so absence is a real "no manual widths").
		const updated = await app
			.put(`/api/v1/dashboards/${id}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ ...base, columnWidths: { owner: 200 } });
		expect(updated.status).toBe(200);
		expect((await listById())?.columnWidths).toEqual({ owner: 200 });

		const cleared = await app
			.put(`/api/v1/dashboards/${id}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ ...base, columnWidths: undefined });
		expect(cleared.status).toBe(200);
		expect((await listById())?.columnWidths).toBeUndefined();
	});

	test('rejects non-positive column widths', async () => {
		const res = await app
			.post('/api/v1/dashboards')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				name: 'bad widths',
				type: 'alerts' as const,
				description: '',
				filters: {},
				visibleColumns: ['type'],
				columnWidths: { alertName: 0 },
				query: '',
				groupBy: [],
			});
		expect(res.status).toBe(400);
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

// The alerts toolbar toggles are booleans, but SQLite has no boolean type and better-sqlite3
// refuses to bind one ("can only bind numbers, strings, bigints, buffers, and null") — so
// these round-trips are what prove the 0/1 conversion is in place at both ends. An absent
// value must stay absent rather than collapsing to false: the client resolves "never
// configured" from the user's legacy per-browser preference.
describe('Dashboards API — toolbar toggle persistence', () => {
	const base = {
		name: 'toggles test',
		type: 'alerts' as const,
		description: '',
		filters: {},
		visibleColumns: ['type', 'alertName'],
		query: '',
		groupBy: [],
	};

	interface ToggleDashboard {
		id: string | number;
		name: string;
		splitByAssignment?: boolean;
		severityColors?: boolean;
	}

	const findById = async (id: string): Promise<ToggleDashboard | undefined> => {
		const list = await app.get('/api/v1/dashboards').set('Authorization', `Bearer ${jwtToken}`);
		return (list.body.data as ToggleDashboard[]).find((d) => String(d.id) === id);
	};

	test('both toggles survive a create as real booleans', async () => {
		const created = await app
			.post('/api/v1/dashboards')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ ...base, splitByAssignment: true, severityColors: true });
		expect(created.status).toBe(200);

		const saved = await findById(String(created.body.data.id));
		// Strict equality, not truthiness: a 0/1 leaking through would pass a loose check.
		expect(saved?.splitByAssignment).toBe(true);
		expect(saved?.severityColors).toBe(true);
	});

	test('an explicit false is stored as false, not dropped', async () => {
		const created = await app
			.post('/api/v1/dashboards')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ ...base, name: 'explicit false', splitByAssignment: false, severityColors: false });
		expect(created.status).toBe(200);

		const saved = await findById(String(created.body.data.id));
		expect(saved?.splitByAssignment).toBe(false);
		expect(saved?.severityColors).toBe(false);
	});

	test('updates round-trip both directions', async () => {
		const created = await app
			.post('/api/v1/dashboards')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ ...base, name: 'update round trip', splitByAssignment: true, severityColors: false });
		expect(created.status).toBe(200);
		const id = String(created.body.data.id);

		const updated = await app
			.put(`/api/v1/dashboards/${id}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ ...base, name: 'update round trip', splitByAssignment: false, severityColors: true });
		expect(updated.status).toBe(200);

		const saved = await findById(id);
		expect(saved?.splitByAssignment).toBe(false);
		expect(saved?.severityColors).toBe(true);
	});

	test('a dashboard saved without the toggles returns them as undefined', async () => {
		const created = await app
			.post('/api/v1/dashboards')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ ...base, name: 'no toggles' });
		expect(created.status).toBe(200);

		const saved = await findById(String(created.body.data.id));
		expect(saved?.splitByAssignment).toBeUndefined();
		expect(saved?.severityColors).toBeUndefined();
	});

	test('a non-boolean toggle is rejected', async () => {
		const created = await app
			.post('/api/v1/dashboards')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ ...base, name: 'bad toggle', severityColors: 'yes' });
		expect(created.status).toBe(400);
	});
});
