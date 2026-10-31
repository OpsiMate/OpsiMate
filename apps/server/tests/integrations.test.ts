import { SuperTest, Test } from 'supertest';
import { Integration, IntegrationType } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { afterEach, expect, vi } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';
import { GrafanaClient } from '../src/dal/external-client/grafana-client';
import { GrafanaIntegrationConnector } from '../src/bl/integrations/integration-connector/grafana-integration-connector';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

interface TestConnectionCredentials {
	apiKey?: string;
	appKey?: string;
}

interface TestConnectionBody {
	name?: string;
	type?: string;
	externalUrl?: string;
	credentials?: TestConnectionCredentials;
}

interface InvalidBodyCase {
	label: string;
	body: TestConnectionBody;
}

interface GrafanaHealth {
	commit: string;
	database: string;
	version: string;
}

const TEST_CONNECTION_URL = '/api/v1/integrations/test-connection';

const validGrafanaBody: TestConnectionBody = {
	name: 'Grafana under test',
	type: IntegrationType.Grafana,
	externalUrl: 'https://grafana.example.com',
	credentials: { apiKey: 'test-api-key' },
};

const healthyGrafana: GrafanaHealth = { commit: 'x', database: 'ok', version: '11.0.0' };

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
				appKey: 'new-app-key',
			},
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
				appKey: 'updated-app-key',
			},
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

		const updatedIntegration = getRes.body.data.integrations.find(
			(i: Integration) => i.name === 'Updated Integration'
		);
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
		expect(deleteRes.body.message).toBe('Integration deleted successfully');

		// Verify the integration was deleted
		const getRes = await app.get('/api/v1/integrations').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);

		const deletedIntegration = getRes.body.data.integrations.find(
			(i: Integration) => i.name === 'Test Integration'
		);
		expect(deletedIntegration).toBeUndefined();
	});

	test('should return 404 when updating a non-existent integration', async () => {
		const updateRes = await app
			.put('/api/v1/integrations/9999')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				name: 'Updated Integration',
				type: IntegrationType.Datadog,
				externalUrl: 'https://datadog.example.com',
				credentials: { apiKey: 'updated-api-key' },
			});

		expect(updateRes.status).toBe(404);
		expect(updateRes.body.success).toBe(false);
	});

	test('should return 404 when deleting a non-existent integration', async () => {
		const deleteRes = await app.delete('/api/v1/integrations/9999').set('Authorization', `Bearer ${jwtToken}`);

		expect(deleteRes.status).toBe(404);
		expect(deleteRes.body.success).toBe(false);
	});

	test('should return 404 for integration URLs of a non-existent integration', async () => {
		const urlsRes = await app
			.get('/api/v1/integrations/9999/urls?tags=x')
			.set('Authorization', `Bearer ${jwtToken}`);

		expect(urlsRes.status).toBe(404);
		expect(urlsRes.body.success).toBe(false);
	});

	test('should return 400 for integration URLs with a non-numeric integration ID', async () => {
		const urlsRes = await app
			.get('/api/v1/integrations/abc/urls?tags=x')
			.set('Authorization', `Bearer ${jwtToken}`);

		expect(urlsRes.status).toBe(400);
		expect(urlsRes.body.success).toBe(false);
	});

	test('should return 400 for integration URLs with a trailing non-numeric suffix on the ID', async () => {
		const urlsRes = await app
			.get('/api/v1/integrations/1abc/urls?tags=x')
			.set('Authorization', `Bearer ${jwtToken}`);

		expect(urlsRes.status).toBe(400);
		expect(urlsRes.body.success).toBe(false);
	});

	test('should require authentication', async () => {
		const getRes = await app.get('/api/v1/integrations');
		expect(getRes.status).toBe(401);

		const createRes = await app.post('/api/v1/integrations').send({
			name: 'Unauthorized Integration',
			type: IntegrationType.Grafana,
			externalUrl: 'https://grafana.example.com',
			credentials: {
				apiKey: 'unauthorized-api-key',
			},
		});
		expect(createRes.status).toBe(401);
	});

	// todo: mock grafana client and uncomment
	// test('should get integration URLs by tags', async () => {
	// 	// First create a test integration with known ID
	// 	const integrationData = {
	// 		name: 'URL Test Integration',
	// 		type: IntegrationType.Grafana,
	// 		externalUrl: 'https://grafana.example.com',
	// 		credentials: {
	// 			apiKey: 'url-test-api-key'
	// 		}
	// 	};
	//
	// 	const createRes = await app
	// 		.post('/api/v1/integrations')
	// 		.set('Authorization', `Bearer ${jwtToken}`)
	// 		.send(integrationData);
	//
	// 	expect(createRes.status).toBe(201);
	// 	const integrationId = createRes.body.data.id;
	//
	// 	// Now test the URLs endpoint
	// 	const urlsRes = await app
	// 		.get(`/api/v1/integrations/${integrationId}/urls?tags=test`)
	// 		.set('Authorization', `Bearer ${jwtToken}`);
	//
	// 	expect(urlsRes.status).toBe(200);
	// 	expect(urlsRes.body.success).toBe(true);
	// 	expect(urlsRes.body.data).toBeDefined();
	// });

	test('should handle validation errors', async () => {
		const invalidData = {
			// Missing required fields
			name: '',
			type: 'InvalidType',
			externalUrl: 'not-a-url',
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

describe('POST /api/v1/integrations/test-connection', () => {
	const postTestConnection = (body: TestConnectionBody) =>
		app.post(TEST_CONNECTION_URL).set('Authorization', `Bearer ${jwtToken}`).send(body);

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('should require authentication', async () => {
		const res = await app.post(TEST_CONNECTION_URL).send(validGrafanaBody);
		expect(res.status).toBe(401);
	});

	const invalidBodies: InvalidBodyCase[] = [
		{ label: 'an empty body', body: {} },
		{ label: 'a type that is not an IntegrationType', body: { ...validGrafanaBody, type: 'Prometheus' } },
		{ label: 'a non-URL externalUrl', body: { ...validGrafanaBody, externalUrl: 'not-a-url' } },
		{ label: 'an apiKey with a space', body: { ...validGrafanaBody, credentials: { apiKey: 'has a space' } } },
	];

	test.each(invalidBodies)('should return 400 for $label', async ({ body }) => {
		const getHealth = vi.spyOn(GrafanaClient.prototype, 'getHealth').mockResolvedValue(healthyGrafana);

		const res = await postTestConnection(body);

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(res.body.error).toBe('Validation error');
		expect(Array.isArray(res.body.details)).toBe(true);
		expect(getHealth).not.toHaveBeenCalled();
	});

	test('should report a valid connection when Grafana is healthy', async () => {
		const getHealth = vi.spyOn(GrafanaClient.prototype, 'getHealth').mockResolvedValue(healthyGrafana);

		const res = await postTestConnection(validGrafanaBody);

		expect(res.status).toBe(200);
		expect(res.body).toEqual({ success: true, data: { isValidConnection: true } });
		expect(getHealth).toHaveBeenCalledTimes(1);
	});

	test("should return 200 with the connector's error when the Grafana health check fails", async () => {
		vi.spyOn(GrafanaClient.prototype, 'getHealth').mockRejectedValue(new Error('Grafana health check failed: 401'));

		const res = await postTestConnection(validGrafanaBody);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(false);
		expect(res.body.error).toBe('Grafana health check failed: 401');
		expect(res.body.data.isValidConnection).toBe(false);
	});

	test.each([IntegrationType.Kibana, IntegrationType.Datadog])(
		'should return 200 with "not yet implemented" for %s',
		async (type) => {
			const res = await postTestConnection({ ...validGrafanaBody, type });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(false);
			expect(res.body.error).toBe(`${type} integration connector not yet implemented.`);
			expect(res.body.data.isValidConnection).toBe(false);
		}
	);

	test('should return 500 when the connector throws', async () => {
		vi.spyOn(GrafanaIntegrationConnector.prototype, 'testConnection').mockRejectedValue(new Error('boom'));

		const res = await postTestConnection(validGrafanaBody);

		expect(res.status).toBe(500);
		expect(res.body.success).toBe(false);
		expect(res.body.error).toBe('Internal server error');
	});

	test('should not persist the tested integration', async () => {
		vi.spyOn(GrafanaClient.prototype, 'getHealth').mockResolvedValue(healthyGrafana);

		const testRes = await postTestConnection(validGrafanaBody);
		expect(testRes.status).toBe(200);
		expect(testRes.body.success).toBe(true);

		const getRes = await app.get('/api/v1/integrations').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);
		const integrations = getRes.body.data.integrations as Integration[];
		expect(integrations).toHaveLength(1);
		expect(integrations[0].name).toBe('Test Integration');
	});
});
