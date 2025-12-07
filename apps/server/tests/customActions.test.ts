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
	describe('Create', () => {
		it('should create a bash action', async () => {
			const createRes = await app.post('/api/v1/custom-actions').set('Authorization', `Bearer ${jwtToken}`).send({
				name: 'Bash Action',
				description: 'Test bash action',
				type: 'bash',
				target: 'provider',
				script: 'echo hello',
			});

			expect(createRes.status).toBe(201);
			expect(createRes.body.success).toBe(true);
			expect(createRes.body.data.id).toBeDefined();
			expect(typeof createRes.body.data.id).toBe('number');

			// Verify the created action
			const getRes = await app
				.get(`/api/v1/custom-actions/${createRes.body.data.id}`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(getRes.body.data.type).toBe('bash');
			expect(getRes.body.data.script).toBe('echo hello');
		});

		it('should create an http action', async () => {
			const createRes = await app
				.post('/api/v1/custom-actions')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({
					name: 'Do Cool Http Request',
					description: 'Cool Request',
					target: 'service',
					type: 'http',
					url: 'https://www.google.com',
					method: 'POST',
					headers: { apple: 'key' },
					body: '{\n"fdfd":"fdfd"\n}',
				});

			expect(createRes.status).toBe(201);
			expect(createRes.body.success).toBe(true);
			expect(createRes.body.data.id).toBeDefined();
			expect(typeof createRes.body.data.id).toBe('number');

			// Verify the created action
			const getRes = await app
				.get(`/api/v1/custom-actions/${createRes.body.data.id}`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(getRes.body.data.type).toBe('http');
			expect(getRes.body.data.url).toBe('https://www.google.com');
			expect(getRes.body.data.method).toBe('POST');
			expect(getRes.body.data.headers).toEqual({ apple: 'key' });
			expect(getRes.body.data.body).toBe('{\n"fdfd":"fdfd"\n}');
		});

		it('should create an http action with minimal fields', async () => {
			const createRes = await app.post('/api/v1/custom-actions').set('Authorization', `Bearer ${jwtToken}`).send({
				name: 'Simple HTTP Action',
				description: 'Simple request',
				target: 'provider',
				type: 'http',
				url: 'https://api.example.com/endpoint',
				method: 'GET',
			});

			expect(createRes.status).toBe(201);
			expect(createRes.body.success).toBe(true);

			// Verify the created action
			const getRes = await app
				.get(`/api/v1/custom-actions/${createRes.body.data.id}`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(getRes.body.data.type).toBe('http');
			expect(getRes.body.data.url).toBe('https://api.example.com/endpoint');
			expect(getRes.body.data.method).toBe('GET');
			expect(getRes.body.data.headers).toBeNull();
			expect(getRes.body.data.body).toBeNull();
		});
	});

	describe('Get', () => {
		it('should get a bash action by id', async () => {
			// First create an action
			const createRes = await app.post('/api/v1/custom-actions').set('Authorization', `Bearer ${jwtToken}`).send({
				name: 'Get Test Action',
				description: 'Action for get test',
				type: 'bash',
				target: 'service',
				script: 'echo test',
			});
			const actionId = createRes.body.data.id as number;

			// Then get it
			const getRes = await app
				.get(`/api/v1/custom-actions/${actionId}`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(getRes.status).toBe(200);
			expect(getRes.body.success).toBe(true);
			expect(getRes.body.data).toBeDefined();
			expect(getRes.body.data.id).toBe(actionId);
			expect(getRes.body.data.name).toBe('Get Test Action');
			expect(getRes.body.data.description).toBe('Action for get test');
			expect(getRes.body.data.type).toBe('bash');
			expect(getRes.body.data.target).toBe('service');
			expect(getRes.body.data.script).toBe('echo test');
		});

		it('should return 404 when getting a non-existent custom action', async () => {
			const getRes = await app.get('/api/v1/custom-actions/99999').set('Authorization', `Bearer ${jwtToken}`);

			expect(getRes.status).toBe(404);
			expect(getRes.body.success).toBe(false);
			expect(getRes.body.error).toBe('Not found');
		});
	});

	describe('List', () => {
		it('should list all custom actions', async () => {
			// Create a couple of actions first
			await app.post('/api/v1/custom-actions').set('Authorization', `Bearer ${jwtToken}`).send({
				name: 'List Action 1',
				description: 'First action',
				type: 'bash',
				target: 'provider',
				script: 'echo one',
			});

			await app.post('/api/v1/custom-actions').set('Authorization', `Bearer ${jwtToken}`).send({
				name: 'List Action 2',
				description: 'Second action',
				type: 'bash',
				target: null,
				script: 'echo two',
			});

			const listRes = await app.get('/api/v1/custom-actions').set('Authorization', `Bearer ${jwtToken}`);

			expect(listRes.status).toBe(200);
			expect(listRes.body.success).toBe(true);
			expect(Array.isArray(listRes.body.data.actions)).toBe(true);
			expect(listRes.body.data.actions.length).toBeGreaterThanOrEqual(2);

			// Verify structure of returned actions
			const actions = listRes.body.data.actions;
			actions.forEach((action: any) => {
				expect(action.id).toBeDefined();
				expect(action.name).toBeDefined();
				expect(action.description).toBeDefined();
				expect(['bash', 'http']).toContain(action.type);
				expect(['provider', 'service', null]).toContain(action.target);

				if (action.type === 'bash') {
					expect(action.script).toBeDefined();
				} else if (action.type === 'http') {
					expect(action.url).toBeDefined();
					expect(action.method).toBeDefined();
				}
			});
		});
	});

	describe('Update', () => {
		it('should update a bash action', async () => {
			// First create an action
			const createRes = await app.post('/api/v1/custom-actions').set('Authorization', `Bearer ${jwtToken}`).send({
				name: 'Update Test Action',
				description: 'Original description',
				type: 'bash',
				target: 'provider',
				script: 'echo original',
			});
			const actionId = createRes.body.data.id as number;

			// Then update it
			const updateRes = await app
				.put(`/api/v1/custom-actions/${actionId}`)
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({
					name: 'Updated Action',
					description: 'Updated description',
					type: 'bash',
					target: 'service',
					script: 'echo updated',
				});

			expect(updateRes.status).toBe(200);
			expect(updateRes.body.success).toBe(true);

			// Verify the update by getting the action
			const getRes = await app
				.get(`/api/v1/custom-actions/${actionId}`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(getRes.body.data.name).toBe('Updated Action');
			expect(getRes.body.data.description).toBe('Updated description');
			expect(getRes.body.data.target).toBe('service');
			expect(getRes.body.data.script).toBe('echo updated');
		});

		it('should return 400 when updating with invalid data', async () => {
			// First create an action
			const createRes = await app.post('/api/v1/custom-actions').set('Authorization', `Bearer ${jwtToken}`).send({
				name: 'Test Action',
				description: 'Test',
				type: 'bash',
				target: 'provider',
				script: 'echo test',
			});
			const actionId = createRes.body.data.id as number;

			// Try to update with invalid data (missing required fields)
			const updateRes = await app
				.put(`/api/v1/custom-actions/${actionId}`)
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({
					name: '', // Empty name should fail validation
					description: 'Test',
					type: 'bash',
				});

			expect(updateRes.status).toBe(400);
			expect(updateRes.body.success).toBe(false);
			expect(updateRes.body.error).toBe('Validation error');
		});
	});

	describe('Delete', () => {
		it('should delete a custom action', async () => {
			// First create an action
			const createRes = await app.post('/api/v1/custom-actions').set('Authorization', `Bearer ${jwtToken}`).send({
				name: 'Delete Test Action',
				description: 'Action to delete',
				type: 'bash',
				target: 'provider',
				script: 'echo delete',
			});
			const actionId = createRes.body.data.id as number;

			// Delete it
			const deleteRes = await app
				.delete(`/api/v1/custom-actions/${actionId}`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(deleteRes.status).toBe(200);
			expect(deleteRes.body.success).toBe(true);

			// Verify it's deleted by trying to get it
			const getRes = await app
				.get(`/api/v1/custom-actions/${actionId}`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(getRes.status).toBe(404);
		});
	});

	describe('Run Actions', () => {
		it('should run an action against provider and service endpoints', async () => {
			// Create provider to attach run
			const providerCreate = await app.post('/api/v1/providers').set('Authorization', `Bearer ${jwtToken}`).send({
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
			const serviceCreate = await app.post('/api/v1/services').set('Authorization', `Bearer ${jwtToken}`).send({
				name: 'S1',
				providerId,
				serviceType: 'DOCKER',
				serviceStatus: 'running',
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
});
