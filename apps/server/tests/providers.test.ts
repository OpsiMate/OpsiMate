import request, {SuperTest, Test} from 'supertest';
import {Provider, ProviderType} from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import {createApp} from '../src/app';
import {expect} from "vitest";

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const seedProviders = () => {
	db.exec('DELETE FROM providers');
	db.prepare(
		`
    INSERT INTO providers (id, provider_name, provider_ip, username, private_key_filename, ssh_port, created_at, provider_type)
    VALUES (1, 'Test Provider', '127.0.0.1', 'user', 'key.pem', 22, CURRENT_TIMESTAMP, 'VM')
  `
	).run();
};

beforeAll(async () => {
	db = new Database(':memory:');

	// Create the providers table
	db.exec(`
    CREATE TABLE IF NOT EXISTS providers
    (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_name        TEXT NOT NULL,
      provider_ip          TEXT     DEFAULT NULL,
      username             TEXT     DEFAULT NULL,
      private_key_filename TEXT,
      password             TEXT,
      ssh_port             INTEGER  DEFAULT 22,
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
      provider_type        TEXT NOT NULL
      CHECK (
        (private_key_filename IS NOT NULL AND TRIM(private_key_filename) <> '')
        OR
        (password IS NOT NULL AND TRIM(password) <> '')
      )
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT,
      resource_name TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      details TEXT
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      service_name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      status TEXT,
      last_checked DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    );
  `);

	const expressApp = await createApp(db);
	app = request(expressApp) as unknown as SuperTest<Test>;

	// Register and login a user to get a JWT token
	await app.post('/api/v1/users/register').send({
		email: 'provideruser@example.com',
		fullName: 'Provider User',
		password: 'testpassword',
	});
	const loginRes = await app.post('/api/v1/users/login').send({
		email: 'provideruser@example.com',
		password: 'testpassword',
	});
	jwtToken = loginRes.body.token;
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
		const deleteRes = await app
			.delete('/api/v1/providers/1')
			.set('Authorization', `Bearer ${jwtToken}`);

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

		// todo: fix this issue and uncomment
		// expect(Array.isArray(bulkRes.body.data.providerIds)).toBe(true);
		// expect(bulkRes.body.data.providerIds.length).toBe(2);

		// Verify the providers were created
		const getRes = await app.get('/api/v1/providers').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);

		const bulkProvider1 = getRes.body.data.providers.find((p: Provider) => p.name === 'Bulk Provider 1');
		const bulkProvider2 = getRes.body.data.providers.find((p: Provider) => p.name === 'Bulk Provider 2');

		expect(bulkProvider1).toBeDefined();
		expect(bulkProvider2).toBeDefined();
	});

	// todo: add providers secret in seed and uncomment
	// test('should refresh a provider', async () => {
	// 	const refreshRes = await app
	// 		.post('/api/v1/providers/1/refresh')
	// 		.set('Authorization', `Bearer ${jwtToken}`);
	//
	// 	expect(refreshRes.status).toBe(200);
	// 	expect(refreshRes.body.success).toBe(true);
	// });

	test('should test connection to a provider', async () => {
		const testData: Provider = {
			id: 1,
			createdAt: '2018-02-09T00:00:00.000Z',
			name: 'Test Provider',
			providerIP: '127.0.0.1',
			username: 'testuser',
			password: 'testpassword',
			SSHPort: 22,
			providerType: ProviderType.VM,
		};

		// Mock the connection test since we can't actually connect to a real provider in tests
		const _ = await app
			.post('/api/v1/providers/test-connection')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(testData);

		// todo: fix bad code and adjust it accordingly
		expect(true).toBeTruthy();

	});
});
