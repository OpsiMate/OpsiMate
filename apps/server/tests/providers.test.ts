import { SuperTest, Test } from 'supertest';
import { Provider } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { expect } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const seedProviders = () => {
	db.exec('DELETE FROM providers');
	db.prepare(
		`
			INSERT INTO providers (id, provider_name, provider_ip, username, private_key_filename, ssh_port, created_at,
								   provider_type)
			VALUES (1, 'Test Provider', '127.0.0.1', 'user', 'key.pem', 22, CURRENT_TIMESTAMP, 'VM')`
	).run();
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

beforeEach(() => {
	seedProviders();
});

afterAll(() => {
	db.close();
});

describe('Providers API', () => {
	test('should get all providers', async () => {
		const res = await app.get('/api/v1/providers').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		const providersRes = res.body.data.providers as Provider[];
		expect(Array.isArray(providersRes)).toBe(true);
		expect(providersRes.length).toEqual(1);

		const provider: Provider = providersRes[0];
		expect(provider.id).toBeDefined();
		expect(provider.name).toBe('Test Provider');
		expect(provider.providerIP).toBe('127.0.0.1');
		expect(provider.username).toBe('user');
		expect(provider.privateKeyFilename).toBe('key.pem');
		expect(provider.SSHPort).toBe(22);
		expect(provider.providerType).toBe('VM');
	});

	test('should create a new provider', async () => {
		const providerData = {
			name: 'New Provider',
			providerIP: '192.168.1.1',
			username: 'newuser',
			password: 'newpassword',
			SSHPort: 2222,
			providerType: 'VM',
		};

		const createRes = await app
			.post('/api/v1/providers')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(providerData);

		expect(createRes.status).toBe(201);
		expect(createRes.body.success).toBe(true);
		expect(createRes.body.data.id).toBeDefined();

		// Verify the provider was created
		const getRes = await app.get('/api/v1/providers').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);

		const newProvider = getRes.body.data.providers.find((p: Provider) => p.name === 'New Provider') as Provider;
		expect(newProvider).toBeDefined();
		expect(newProvider.providerIP).toBe('192.168.1.1');
		expect(newProvider.username).toBe('newuser');
		expect(newProvider.SSHPort).toBe(2222);
		expect(newProvider.providerType).toBe('VM');
	});

	test('should update an existing provider', async () => {
		const updateData = {
			name: 'Updated Provider',
			providerIP: '10.0.0.1',
			username: 'updateduser',
			password: 'updatedpassword',
			SSHPort: 2222,
			providerType: 'VM',
		};

		const updateRes = await app
			.put('/api/v1/providers/1')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(updateData);

		expect(updateRes.status).toBe(200);
		expect(updateRes.body.success).toBe(true);

		// Verify the provider was updated
		const getRes = await app.get('/api/v1/providers').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);

		const newProvider = getRes.body.data.providers.find((p: Provider) => p.name === 'Updated Provider') as Provider;
		expect(newProvider).toBeDefined();
		expect(newProvider.providerIP).toBe('10.0.0.1');
		expect(newProvider.username).toBe('updateduser');
		expect(newProvider.SSHPort).toBe(2222);
		expect(newProvider.providerType).toBe('VM');
	});

	test('should delete a provider', async () => {
		const deleteRes = await app.delete('/api/v1/providers/1').set('Authorization', `Bearer ${jwtToken}`);

		expect(deleteRes.status).toBe(200);
		expect(deleteRes.body.success).toBe(true);

		// Verify the provider was deleted
		const getRes = await app.get('/api/v1/providers').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);

		const newProvider = getRes.body.data.providers.find((p: Provider) => p.name === 'Test Provider') as Provider;
		expect(newProvider).toBeUndefined();
	});

	test('should require authentication', async () => {
		const getRes = await app.get('/api/v1/providers');
		expect(getRes.status).toBe(401);

		const createRes = await app.post('/api/v1/providers').send({
			name: 'Unauthorized Provider',
			providerIP: '192.168.1.1',
			username: 'user',
			password: 'password',
			SSHPort: 22,
			providerType: 'VM',
		});
		expect(createRes.status).toBe(401);
	});

	test('should handle bulk creation of providers', async () => {
		const providersData = [
			{
				name: 'Bulk Provider 1',
				providerIP: '10.0.0.1',
				username: 'bulkuser1',
				password: 'bulkpassword1',
				SSHPort: 22,
				providerType: 'VM',
			},
			{
				name: 'Bulk Provider 2',
				providerIP: '10.0.0.2',
				username: 'bulkuser2',
				password: 'bulkpassword2',
				SSHPort: 22,
				providerType: 'VM',
			},
		];

		const bulkRes = await app
			.post('/api/v1/providers/bulk')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ providers: providersData });

		expect(bulkRes.status).toBe(201);
		expect(bulkRes.body.success).toBe(true);

		expect(Array.isArray(bulkRes.body.data.providerIds)).toBe(true);
		expect(bulkRes.body.data.providerIds.length).toBe(2);

		// Verify the providers were created
		const getRes = await app.get('/api/v1/providers').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);

		const bulkProvider1 = getRes.body.data.providers.find((p: Provider) => p.name === 'Bulk Provider 1');
		const bulkProvider2 = getRes.body.data.providers.find((p: Provider) => p.name === 'Bulk Provider 2');

		expect(bulkProvider1).toBeDefined();
		expect(bulkProvider2).toBeDefined();
	});

	test('bulk creation should return a well-formed response structure', async () => {
		const providersData = [
			{
				name: 'Structured Provider',
				providerIP: '10.0.1.1',
				username: 'structureduser',
				password: 'structuredpassword',
				SSHPort: 22,
				providerType: 'VM',
			},
		];

		const bulkRes = await app
			.post('/api/v1/providers/bulk')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ providers: providersData });

		expect(bulkRes.status).toBe(201);
		expect(bulkRes.body).toMatchObject({ success: true });
		expect(bulkRes.body.data).toBeDefined();
		expect(Array.isArray(bulkRes.body.data.providerIds)).toBe(true);
		expect(bulkRes.body.data.providerIds.length).toBe(providersData.length);
		// every returned id should be a number
		bulkRes.body.data.providerIds.forEach((id: unknown) => {
			expect(typeof id).toBe('number');
		});
	});

	test('bulk creation should require authentication', async () => {
		const bulkRes = await app.post('/api/v1/providers/bulk').send({
			providers: [
				{
					name: 'Unauthorized Bulk Provider',
					providerIP: '10.0.2.1',
					username: 'unauthuser',
					password: 'unauthpassword',
					SSHPort: 22,
					providerType: 'VM',
				},
			],
		});

		expect(bulkRes.status).toBe(401);
	});

	test('bulk creation should reject an empty providers array with 400', async () => {
		const bulkRes = await app
			.post('/api/v1/providers/bulk')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ providers: [] });

		expect(bulkRes.status).toBe(400);
		expect(bulkRes.body.success).toBe(false);
		expect(bulkRes.body.error).toBe('Validation error');
	});

	test('bulk creation should reject a missing providers field with 400', async () => {
		const bulkRes = await app.post('/api/v1/providers/bulk').set('Authorization', `Bearer ${jwtToken}`).send({});

		expect(bulkRes.status).toBe(400);
		expect(bulkRes.body.success).toBe(false);
	});

	test('bulk creation should reject the whole batch when one provider is invalid (partial failure)', async () => {
		const providersData = [
			{
				name: 'Valid Provider',
				providerIP: '10.0.3.1',
				username: 'validuser',
				password: 'validpassword',
				SSHPort: 22,
				providerType: 'VM',
			},
			{
				// invalid: unknown providerType and no password/secret
				name: 'Invalid Provider',
				providerIP: '10.0.3.2',
				username: 'invaliduser',
				SSHPort: 22,
				providerType: 'NOT_A_REAL_TYPE',
			},
		];

		const bulkRes = await app
			.post('/api/v1/providers/bulk')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ providers: providersData });

		expect(bulkRes.status).toBe(400);
		expect(bulkRes.body.success).toBe(false);
		expect(bulkRes.body.error).toBe('Validation error');

		// validation happens before any insert, so no provider from the batch should be persisted
		const getRes = await app.get('/api/v1/providers').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);
		const validProvider = getRes.body.data.providers.find((p: Provider) => p.name === 'Valid Provider');
		expect(validProvider).toBeUndefined();
		// only the seeded provider should remain
		expect(getRes.body.data.providers.length).toBe(1);
	});

	// todo: add tests to the following routes:
	// router.post('/:providerId/refresh', controller.refreshProvider.bind(controller));
	// router.post('/test-connection', controller.testConnection.bind(controller));
	// router.get('/:providerId/discover-services', controller.discoverServices.bind(controller));
});
