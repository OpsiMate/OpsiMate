import { SuperTest, Test } from 'supertest';
import type { Response } from 'supertest';
import Database from 'better-sqlite3';
import { expect } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

interface CreatedPolicy {
	id: number;
}

async function createPolicy(body: Record<string, unknown>): Promise<CreatedPolicy> {
	const res = await app.post('/api/v1/mute-policies').set('Authorization', `Bearer ${jwtToken}`).send(body);
	expect(res.status).toBe(201);
	return { id: res.body.data.id as number };
}

async function putPolicy(id: number, body: Record<string, unknown>) {
	return await app.put(`/api/v1/mute-policies/${id}`).set('Authorization', `Bearer ${jwtToken}`).send(body);
}

async function getPolicy(id: number) {
	const res = await app.get(`/api/v1/mute-policies/${id}`).set('Authorization', `Bearer ${jwtToken}`);
	expect(res.status).toBe(200);
	return res.body.data as Record<string, unknown>;
}

interface ValidationIssue {
	message: string;
}

interface ValidationBody {
	details?: ValidationIssue[];
}

function expectValidationIssue(res: Response, message: string): void {
	const body = res.body as ValidationBody;
	expect(body.details).toBeDefined();
	expect(body.details?.some((d) => d.message === message)).toBe(true);
}

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

afterAll(() => {
	db.close();
});

// PUT used to validate only the fields in the request body and never against the
// stored policy, so edits could reach states the create endpoint refuses: a window
// AND a recurring schedule, an empty criteria set, or an end before the start.
describe('PUT /api/v1/mute-policies/:id validates the policy after the update', () => {
	test('one-time policy + schedule -> 400, stored policy keeps schedule: null', async () => {
		const { id } = await createPolicy({
			name: 'Window policy',
			nameContains: 'cpu',
			startsAt: '2026-11-01T10:00:00Z',
			endsAt: '2026-11-01T12:00:00Z',
		});
		const res = await putPolicy(id, {
			schedule: { daysOfWeek: [1, 2], startTime: '09:00', endTime: '17:00' },
		});
		expect(res.status).toBe(400);
		expectValidationIssue(res, 'A recurring schedule cannot be combined with a one-time window');
		const stored = await getPolicy(id);
		expect(stored.schedule).toBeNull();
	});

	test('one-time policy + schedule with the window cleared in the same request -> 200 (switching to recurring works)', async () => {
		const { id } = await createPolicy({
			name: 'Switch to recurring',
			nameContains: 'cpu',
			startsAt: '2026-11-01T10:00:00Z',
			endsAt: '2026-11-01T12:00:00Z',
		});
		const res = await putPolicy(id, {
			schedule: { daysOfWeek: [1, 2], startTime: '09:00', endTime: '17:00' },
			startsAt: null,
			endsAt: null,
		});
		expect(res.status).toBe(200);
		const stored = await getPolicy(id);
		expect(stored.schedule).toEqual({ daysOfWeek: [1, 2], startTime: '09:00', endTime: '17:00' });
		expect(stored.startsAt).toBeNull();
		expect(stored.endsAt).toBeNull();
	});

	test('name-only policy + clearing the name -> 400, stored name unchanged', async () => {
		const { id } = await createPolicy({ name: 'Named', nameContains: 'cpu' });
		const res = await putPolicy(id, { nameContains: null });
		expect(res.status).toBe(400);
		expectValidationIssue(res, 'Provide at least a name match, one label matcher, or enable match-all');
		const stored = await getPolicy(id);
		expect(stored.nameContains).toBe('cpu');
	});

	test('nameContainsAny policy + clearing the list -> 400, stored list unchanged', async () => {
		const { id } = await createPolicy({ name: 'Listed', nameContainsAny: ['a', 'b'] });
		const res = await putPolicy(id, { nameContainsAny: [] });
		expect(res.status).toBe(400);
		expectValidationIssue(res, 'Provide at least a name match, one label matcher, or enable match-all');
		const stored = await getPolicy(id);
		expect(stored.nameContainsAny).toEqual(['a', 'b']);
	});

	test('matchAll-only policy + matchAll: false -> 400, stored matchAll unchanged', async () => {
		const { id } = await createPolicy({ name: 'Everything', matchAll: true });
		const res = await putPolicy(id, { matchAll: false });
		expect(res.status).toBe(400);
		expectValidationIssue(res, 'Provide at least a name match, one label matcher, or enable match-all');
		const stored = await getPolicy(id);
		expect(stored.matchAll).toBe(true);
	});

	test('replacing the whole criteria set in one request -> 200', async () => {
		const { id } = await createPolicy({ name: 'Swap criteria', nameContains: 'cpu' });
		const res = await putPolicy(id, {
			nameContains: null,
			labelMatchers: [{ key: 'env', value: 'prod' }],
		});
		expect(res.status).toBe(200);
		const stored = await getPolicy(id);
		expect(stored.nameContains).toBeNull();
		expect(stored.labelMatchers).toEqual([{ key: 'env', value: 'prod' }]);
	});

	test('window policy + endsAt before the stored startsAt -> 400, stored endsAt unchanged', async () => {
		const { id } = await createPolicy({
			name: 'Window',
			nameContains: 'cpu',
			startsAt: '2026-11-01T10:00:00Z',
			endsAt: '2026-11-01T12:00:00Z',
		});
		const res = await putPolicy(id, { endsAt: '2026-10-31T10:00:00Z' });
		expect(res.status).toBe(400);
		expectValidationIssue(res, 'End time must be after start time');
		const stored = await getPolicy(id);
		expect(stored.endsAt).toBe('2026-11-01T12:00:00Z');
	});

	test('renaming a policy with label matchers -> 200, criteria untouched', async () => {
		const { id } = await createPolicy({
			name: 'Env prod',
			labelMatchers: [{ key: 'env', value: 'prod' }],
		});
		const res = await putPolicy(id, { name: 'Renamed' });
		expect(res.status).toBe(200);
		const stored = await getPolicy(id);
		expect(stored.name).toBe('Renamed');
		expect(stored.labelMatchers).toEqual([{ key: 'env', value: 'prod' }]);
		expect(stored.matchAll).toBe(false);
	});
});
