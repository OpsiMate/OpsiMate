import request, { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/app.js'; 
import { Role } from '@OpsiMate/shared';

describe('Providers API - Test Connection Endpoint', () => {
  let app: SuperTest<Test>;
  let db: Database.Database;
  let adminToken: string;
  let editorToken: string;

  beforeAll(async () => {
    db = new Database(':memory:');
    const expressApp = await createApp(db);
    app = request(expressApp) as unknown as SuperTest<Test>;

    // Register admin user & get token
    await app.post('/api/v1/users/register').send({
      email: 'admin@example.com',
      fullName: 'Admin User',
      password: 'securepassword',
    });

    const adminLogin = await app.post('/api/v1/users/login').send({
      email: 'admin@example.com',
      password: 'securepassword',
    });
    adminToken = adminLogin.body.token;

    // Register editor user & get token (for permission test)
    await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
      email: 'editor@example.com',
      fullName: 'Editor User',
      password: 'password123',
      role: Role.Editor,
    });

    const editorLogin = await app.post('/api/v1/users/login').send({
      email: 'editor@example.com',
      password: 'password123',
    });
    editorToken = editorLogin.body.token;
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    // Cleanup providers table if exists to ensure clean slate
    db.exec('DELETE FROM providers');
  });

  test('✅ Successfully test connection with valid provider configuration', async () => {
    // Example valid provider config (adjust to your actual provider schema)
    const validConfig = {
      providerType: 'exampleProvider',
      host: 'valid.host.com',
      username: 'validUser',
      password: 'validPass',
      port: 1234,
      options: {
        ssl: false,
      },
    };

    const res = await app
      .post('/api/v1/providers/test-connection')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validConfig);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('connectionStatus', 'success');
    expect(res.body).not.toHaveProperty('error');
  });

  test('❌ Attempt to test connection with invalid provider configuration (wrong credentials)', async () => {
    const invalidConfig = {
      providerType: 'exampleProvider',
      host: 'valid.host.com',
      username: 'wrongUser',
      password: 'wrongPass',
      port: 1234,
      options: {
        ssl: false,
      },
    };

    const res = await app
      .post('/api/v1/providers/test-connection')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(invalidConfig);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('connectionStatus', 'failure');
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
  });

  test('❌ Attempt to test connection with invalid provider configuration (unreachable host)', async () => {
    const unreachableConfig = {
      providerType: 'exampleProvider',
      host: 'unreachable.host.com',
      username: 'validUser',
      password: 'validPass',
      port: 1234,
      options: {
        ssl: false,
      },
    };

    const res = await app
      .post('/api/v1/providers/test-connection')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(unreachableConfig);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('connectionStatus', 'failure');
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
  });

  test('🔒 Reject connection test for unauthorized requests (missing token)', async () => {
    const someConfig = {
      providerType: 'exampleProvider',
      host: 'valid.host.com',
      username: 'validUser',
      password: 'validPass',
      port: 1234,
      options: {
        ssl: false,
      },
    };

    const res = await app.post('/api/v1/providers/test-connection').send(someConfig);

    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty('success', false);
  });

  test('🔒 Reject connection test for insufficient permissions (non-admin user)', async () => {
    const someConfig = {
      providerType: 'exampleProvider',
      host: 'valid.host.com',
      username: 'validUser',
      password: 'validPass',
      port: 1234,
      options: {
        ssl: false,
      },
    };

    const res = await app
      .post('/api/v1/providers/test-connection')
      .set('Authorization', `Bearer ${editorToken}`)
      .send(someConfig);

    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty('success', false);
  });

  test('🧾 Validate response structure for success and failure', async () => {
    // Success response check
    const validConfig = {
      providerType: 'exampleProvider',
      host: 'valid.host.com',
      username: 'validUser',
      password: 'validPass',
      port: 1234,
      options: {
        ssl: false,
      },
    };

    const successRes = await app
      .post('/api/v1/providers/test-connection')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validConfig);

    expect(successRes.status).toBe(200);
    expect(successRes.body).toEqual(
      expect.objectContaining({
        success: true,
        connectionStatus: 'success',
      })
    );
    expect(successRes.body).not.toHaveProperty('error');

    // Failure response check
    const invalidConfig = {
      providerType: 'exampleProvider',
      host: 'invalid.host',
      username: 'badUser',
      password: 'badPass',
      port: 1234,
      options: {},
    };

    const failRes = await app
      .post('/api/v1/providers/test-connection')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(invalidConfig);

    expect(failRes.status).toBe(400);
    expect(failRes.body).toEqual(
      expect.objectContaining({
        success: false,
        connectionStatus: 'failure',
      })
    );
    expect(typeof failRes.body.error).toBe('string');
  });

  test('✅ Ensure connection test does not create or modify data', async () => {
    const initialCount = db.prepare('SELECT COUNT(*) as count FROM providers').get().count;

    const testConfig = {
      providerType: 'exampleProvider',
      host: 'valid.host.com',
      username: 'validUser',
      password: 'validPass',
      port: 1234,
      options: {},
    };

    await app
      .post('/api/v1/providers/test-connection')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(testConfig);

    const finalCount = db.prepare('SELECT COUNT(*) as count FROM providers').get().count;

    expect(finalCount).toBe(initialCount); // no new provider created
  });
});
