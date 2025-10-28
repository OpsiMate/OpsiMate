import { SuperTest, Test } from 'supertest';
import { Integration, IntegrationType } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { expect } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const seedIntegrations = () => {
	db.exec('DELETE FROM integrations');
	db.prepare(
		`
			INSERT INTO integrations (id, name, type, external_url, credentials, created_at)
			VALUES (1, 'Test Integration', 'Grafana', 'https://grafana.example.com', '{"apiKey":"test-api-key"}', CURRENT_TIMESTAMP)`
	).run();
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

beforeEach(() => {
	seedIntegrations();
});

afterAll(() => {
	db.close();
});

describe('Integrations API', () => {
	test('should get all integrations', async () => {
		const res = await app.get('/api/v1/integrations').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		const integrationsRes = res.body.data.integrations as Integration[];
		expect(Array.isArray(integrationsRes)).toBe(true);
		expect(integrationsRes.length).toEqual(1);

		const integration = integrationsRes[0];
		expect(integration.id).toBeDefined();
		expect(integration.name).toBe('Test Integration');
		expect(integration.type).toBe(IntegrationType.Grafana);
		expect(integration.externalUrl).toBe('https://grafana.example.com');
		// Credentials should be excluded from the response
		expect(integration.credentials).toBeUndefined();
	});

	test('should create a new integration', async () => {
		const integrationData = {
			name: 'New Integration',
			type: IntegrationType.Kibana,
			externalUrl: 'https://kibana.example.com',
			credentials: {
				apiKey: 'new-api-key',
				appKey: 'new-app-key'
			}
		};

		const createRes = await app
			.post('/api/v1/integrations')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(integrationData);

		expect(createRes.status).toBe(201);
		expect(createRes.body.success).toBe(true);
		expect(createRes.body.data.id).toBeDefined();

		// Verify the integration was created
		const getRes = await app.get('/api/v1/integrations').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);

		const newIntegration = getRes.body.data.integrations.find((i: Integration) => i.name === 'New Integration');
		expect(newIntegration).toBeDefined();
		expect(newIntegration.type).toBe(IntegrationType.Kibana);
		expect(newIntegration.externalUrl).toBe('https://kibana.example.com');
		// Credentials should be excluded from the response
		expect(newIntegration.credentials).toBeUndefined();
	});

	test('should update an existing integration', async () => {
		const updateData = {
			name: 'Updated Integration',
			type: IntegrationType.Datadog,
			externalUrl: 'https://datadog.example.com',
			credentials: {
				apiKey: 'updated-api-key',
				appKey: 'updated-app-key'
			}
		};

		const updateRes = await app
			.put('/api/v1/integrations/1')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(updateData);

		expect(updateRes.status).toBe(200);
		expect(updateRes.body.success).toBe(true);
		expect(updateRes.body.message).toBe('Integration updated successfully');

		// Verify the integration was updated
		const getRes = await app.get('/api/v1/integrations').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);

		const updatedIntegration = getRes.body.data.integrations.find((i: Integration) => i.name === 'Updated Integration');
		expect(updatedIntegration).toBeDefined();
		expect(updatedIntegration.type).toBe(IntegrationType.Datadog);
		expect(updatedIntegration.externalUrl).toBe('https://datadog.example.com');
		// Credentials should be excluded from the response
		expect(updatedIntegration.credentials).toBeUndefined();
	});

	test('should delete an integration', async () => {
		const deleteRes = await app.delete('/api/v1/integrations/1').set('Authorization', `Bearer ${jwtToken}`);

		expect(deleteRes.status).toBe(200);
		expect(deleteRes.body.success).toBe(true);
		expect(deleteRes.body.message).toBe('Integration and associated services deleted successfully');

		// Verify the integration was deleted
		const getRes = await app.get('/api/v1/integrations').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);

		const deletedIntegration = getRes.body.data.integrations.find((i: Integration) => i.name === 'Test Integration');
		expect(deletedIntegration).toBeUndefined();
	});

	test('should require authentication', async () => {
		const getRes = await app.get('/api/v1/integrations');
		expect(getRes.status).toBe(401);

		const createRes = await app.post('/api/v1/integrations').send({
			name: 'Unauthorized Integration',
			type: IntegrationType.Grafana,
			externalUrl: 'https://grafana.example.com',
			credentials: {
				apiKey: 'unauthorized-api-key'
			}
		});
		expect(createRes.status).toBe(401);
	});

	test('should get integration URLs by tags', async () => {
		// First create a test integration with known ID
		const integrationData = {
			name: 'URL Test Integration',
			type: IntegrationType.Grafana,
			externalUrl: 'https://grafana.example.com',
			credentials: {
				apiKey: 'url-test-api-key'
			}
		};

		const createRes = await app
			.post('/api/v1/integrations')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(integrationData);
		
		expect(createRes.status).toBe(201);
		const integrationId = createRes.body.data.id;

		// Now test the URLs endpoint
		const urlsRes = await app
			.get(`/api/v1/integrations/${integrationId}/urls?tags=test`)
			.set('Authorization', `Bearer ${jwtToken}`);
		
		expect(urlsRes.status).toBe(200);
		expect(urlsRes.body.success).toBe(true);
		expect(urlsRes.body.data).toBeDefined();
	});

	test('should handle validation errors', async () => {
		const invalidData = {
			// Missing required fields
			name: '',
			type: 'InvalidType',
			externalUrl: 'not-a-url'
		};

		const createRes = await app
			.post('/api/v1/integrations')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(invalidData);

		expect(createRes.status).toBe(400);
		expect(createRes.body.success).toBe(false);
		expect(createRes.body.error).toBe('Validation error');
	});
});