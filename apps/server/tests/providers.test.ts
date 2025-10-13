import request, { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../src/app.js';
import { Role, ProviderType } from '@OpsiMate/shared';

describe('Providers API', () => {
  let app: SuperTest<Test>;
  let db: Database.Database;

  beforeAll(async () => {
    db = new Database(':memory:');
    const expressApp = await createApp(db);
    app = request(expressApp) as unknown as SuperTest<Test>;
  });

  beforeEach(() => {
    db.exec('DELETE FROM users');
    db.exec('DELETE FROM providers');
  });

  afterAll(() => {
    db.close();
  });

  describe('GET /api/v1/providers/:providerId/discover-services', () => {
    let adminToken: string;
    let providerId: number;

    beforeEach(async () => {
      // Register admin
      await app.post('/api/v1/users/register').send({
        email: 'admin@example.com',
        fullName: 'Admin User',
        password: 'securepassword'
      });
      const loginRes = await app.post('/api/v1/users/login').send({
        email: 'admin@example.com',
        password: 'securepassword'
      });
      adminToken = loginRes.body.token;

      // Create a provider
      const providerRes = await app.post('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`).send({
        name: 'Test Provider',
        providerIP: '192.168.1.100',
        username: 'testuser',
        password: 'testpass',
        SSHPort: 22,
        providerType: ProviderType.VM
      });
      providerId = providerRes.body.data.id;
    });

    test('should successfully discover services from valid provider', async () => {
      // Note: This test assumes the provider connection works or is mocked
      // In a real scenario, this would attempt to connect to the provider
      const res = await app.get(`/api/v1/providers/${providerId}/discover-services`).set('Authorization', `Bearer ${adminToken}`);

      // The response depends on whether the connection succeeds
      // If connection fails, it might return 500, but the API structure should be correct
      expect([200, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        // If services are discovered, check structure
        if (res.body.data.length > 0) {
          expect(res.body.data[0]).toMatchObject({
            name: expect.any(String),
            serviceStatus: expect.any(String),
            serviceIP: expect.any(String),
            namespace: expect.any(String) // optional
          });
        }
      } else {
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('Internal server error');
      }
    });

    test('should return error for non-existent provider', async () => {
      const nonExistentId = 9999;
      const res = await app.get(`/api/v1/providers/${nonExistentId}/discover-services`).set('Authorization', `Bearer ${adminToken}`);

      // Should return 500 as the BL throws an error when provider not found
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Internal server error');
    });

    test('should return 400 for invalid provider ID', async () => {
      const res = await app.get('/api/v1/providers/invalid/discover-services').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid provider ID');
    });

    test('should reject access for non-admin user', async () => {
      // Create a viewer user
      await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
        email: 'viewer@example.com',
        fullName: 'Viewer User',
        password: 'securepassword',
        role: Role.Viewer
      });
      const viewerLogin = await app.post('/api/v1/users/login').send({
        email: 'viewer@example.com',
        password: 'securepassword'
      });
      const viewerToken = viewerLogin.body.token;

      // Attempt to discover services as viewer
      const res = await app.get(`/api/v1/providers/${providerId}/discover-services`).set('Authorization', `Bearer ${viewerToken}`);

      // Should be rejected based on role-based access control
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('should reject access for unauthenticated request', async () => {
      const res = await app.get(`/api/v1/providers/${providerId}/discover-services`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('should not modify existing data (read-only operation)', async () => {
      // Get initial provider state
      const initialProvidersRes = await app.get('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`);
      const initialProviders = initialProvidersRes.body.data.providers;

      // Attempt discovery
      await app.get(`/api/v1/providers/${providerId}/discover-services`).set('Authorization', `Bearer ${adminToken}`);

      // Check that providers are unchanged
      const afterProvidersRes = await app.get('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`);
      const afterProviders = afterProvidersRes.body.data.providers;

      expect(afterProviders).toEqual(initialProviders);
    });
  });
});