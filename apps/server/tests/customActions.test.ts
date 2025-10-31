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

afterAll(() => {
	db.close();
});

describe('Custom Actions API', () => {
	it('should create, list, update and delete a custom action', async () => {
		const createRes = await app
			.post('/api/v1/custom-actions')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				name: 'Test Action',
				description: 'desc',
				type: 'bash',
				target: 'provider',
				script: 'echo hello',
			});
		expect(createRes.status).toBe(201);
		const id = createRes.body.data.id as number;

		const listRes = await app.get('/api/v1/custom-actions').set('Authorization', `Bearer ${jwtToken}`);
		expect(listRes.status).toBe(200);
		expect(Array.isArray(listRes.body.data.actions)).toBe(true);

		const updateRes = await app
			.put(`/api/v1/custom-actions/${id}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				name: 'Updated Action',
				description: 'new',
				type: 'bash',
				target: 'provider',
				script: 'echo world',
			});
		expect(updateRes.status).toBe(200);

		const deleteRes = await app
			.delete(`/api/v1/custom-actions/${id}`)
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(deleteRes.status).toBe(200);
	});

	it('should run an action against provider and service endpoints (baseline)', async () => {
		// Create provider to attach run
		const providerCreate = await app
			.post('/api/v1/providers')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				name: 'P1',
				providerIP: '127.0.0.1',
				username: 'user',
				password: 'pass',
				SSHPort: 22,
				providerType: 'VM',
			});
		expect(providerCreate.status).toBe(201);
		const providerId = providerCreate.body.data.id as number;

		// Create service to attach run
		const serviceCreate = await app
			.post('/api/v1/services')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				name: 'S1',
				providerId,
				serviceType: 'DOCKER',
			});
		expect(serviceCreate.status).toBe(201);
		const serviceId = serviceCreate.body.data.id as number;

		// Create action
		const actionCreate = await app
			.post('/api/v1/custom-actions')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				name: 'Run Bash',
				description: 'run',
				type: 'bash',
				target: 'provider',
				script: 'echo hi',
			});
		expect(actionCreate.status).toBe(201);
		const actionId = actionCreate.body.data.id as number;

		const runProvider = await app
			.post(`/api/v1/custom-actions/run/provider/${providerId}/${actionId}`)
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(runProvider.status).toBe(200);

		const runService = await app
			.post(`/api/v1/custom-actions/run/service/${serviceId}/${actionId}`)
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(runService.status).toBe(200);
	});
});


