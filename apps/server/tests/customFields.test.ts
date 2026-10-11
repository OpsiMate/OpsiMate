import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { expect } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

beforeEach(() => {
	db.exec('DELETE FROM service_custom_field');
});

afterAll(() => {
	db.close();
});

describe('Custom Fields API', () => {
	test('GET /api/v1/custom-fields without token returns 401', async () => {
		const res = await app.get('/api/v1/custom-fields');
		expect(res.status).toBe(401);
	});

	test('POST /api/v1/custom-fields creates a field', async () => {
		const res = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Owner' });

		expect(res.status).toBe(201);
		expect(res.body.success).toBe(true);
		expect(typeof res.body.data.id).toBe('number');
	});

	test('GET /api/v1/custom-fields returns created field', async () => {
		await app.post('/api/v1/custom-fields').set('Authorization', `Bearer ${jwtToken}`).send({ name: 'Owner' });

		const res = await app.get('/api/v1/custom-fields').set('Authorization', `Bearer ${jwtToken}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.customFields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'Owner',
					createdAt: expect.any(String),
				}),
			])
		);
	});

	test('GET /api/v1/custom-fields/:id returns the field', async () => {
		const createRes = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Owner' });
		const id = createRes.body.data.id;

		const res = await app.get(`/api/v1/custom-fields/${id}`).set('Authorization', `Bearer ${jwtToken}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.customField.name).toBe('Owner');
	});

	test('GET /api/v1/custom-fields/:id with unknown id returns 404', async () => {
		const res = await app.get('/api/v1/custom-fields/999999').set('Authorization', `Bearer ${jwtToken}`);

		expect(res.status).toBe(404);
	});

	test('GET /api/v1/custom-fields/:id with invalid id returns 400', async () => {
		const res = await app.get('/api/v1/custom-fields/abc').set('Authorization', `Bearer ${jwtToken}`);

		expect(res.status).toBe(400);
	});

	test('POST /api/v1/custom-fields with missing name returns 400', async () => {
		const res = await app.post('/api/v1/custom-fields').set('Authorization', `Bearer ${jwtToken}`).send({});

		expect(res.status).toBe(400);
	});

	test('POST /api/v1/custom-fields with empty name returns 400', async () => {
		const res = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: '' });

		expect(res.status).toBe(400);
	});

	test('POST /api/v1/custom-fields with whitespace-only name returns 400', async () => {
		const res = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: '   ' });

		expect(res.status).toBe(400);
	});

	test('POST /api/v1/custom-fields with 101-character name returns 400', async () => {
		const res = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'a'.repeat(101) });

		expect(res.status).toBe(400);
	});

	test('POST /api/v1/custom-fields with 100-character name returns 201', async () => {
		const res = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'a'.repeat(100) });

		expect(res.status).toBe(201);
	});

	test('POST /api/v1/custom-fields with duplicate name (different case) returns 409', async () => {
		await app.post('/api/v1/custom-fields').set('Authorization', `Bearer ${jwtToken}`).send({ name: 'Owner' });

		const res = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'owner' });

		expect(res.status).toBe(409);
	});

	test('PUT /api/v1/custom-fields/:id renames the field', async () => {
		const createRes = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Owner' });
		const id = createRes.body.data.id;

		const updateRes = await app
			.put(`/api/v1/custom-fields/${id}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Team' });

		expect(updateRes.status).toBe(200);

		const getRes = await app.get(`/api/v1/custom-fields/${id}`).set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.body.data.customField.name).toBe('Team');
	});

	test('PUT /api/v1/custom-fields/:id renaming to another field name returns 409', async () => {
		const first = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Owner' });
		const second = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Team' });

		const res = await app
			.put(`/api/v1/custom-fields/${first.body.data.id}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'team' });

		expect(res.status).toBe(409);
	});

	test('PUT /api/v1/custom-fields/:id keeping its own name returns 200', async () => {
		const createRes = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Owner' });
		const id = createRes.body.data.id;

		const res = await app
			.put(`/api/v1/custom-fields/${id}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Owner' });

		expect(res.status).toBe(200);
	});

	test('PUT /api/v1/custom-fields/999999 with valid name returns 404', async () => {
		const res = await app
			.put('/api/v1/custom-fields/999999')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'ValidName' });

		expect(res.status).toBe(404);
	});

	test('PUT /api/v1/custom-fields/:id with empty name returns 400', async () => {
		const createRes = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Owner' });
		const id = createRes.body.data.id;

		const res = await app
			.put(`/api/v1/custom-fields/${id}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: '' });

		expect(res.status).toBe(400);
	});

	test('PUT /api/v1/custom-fields/abc returns 400', async () => {
		const res = await app
			.put('/api/v1/custom-fields/abc')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'ValidName' });

		expect(res.status).toBe(400);
	});

	test('DELETE /api/v1/custom-fields/:id deletes the field', async () => {
		const createRes = await app
			.post('/api/v1/custom-fields')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Owner' });
		const id = createRes.body.data.id;

		const deleteRes = await app.delete(`/api/v1/custom-fields/${id}`).set('Authorization', `Bearer ${jwtToken}`);
		expect(deleteRes.status).toBe(200);

		const getRes = await app.get(`/api/v1/custom-fields/${id}`).set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(404);

		const deleteAgainRes = await app
			.delete(`/api/v1/custom-fields/${id}`)
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(deleteAgainRes.status).toBe(404);
	});

	test('DELETE /api/v1/custom-fields/abc returns 400', async () => {
		const res = await app.delete('/api/v1/custom-fields/abc').set('Authorization', `Bearer ${jwtToken}`);

		expect(res.status).toBe(400);
	});
});
