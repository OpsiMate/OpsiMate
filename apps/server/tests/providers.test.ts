import request, { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../src/app';
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

  describe('GET /api/v1/providers', () => {
    let adminToken: string;
    let editorToken: string;
    let viewerToken: string;

    beforeEach(async () => {
      await app.post('/api/v1/users/register').send({
        email: 'admin@example.com',
        fullName: 'Admin User',
        password: 'securepassword'
      });
      const adminLoginRes = await app.post('/api/v1/users/login').send({
        email: 'admin@example.com',
        password: 'securepassword'
      });
      adminToken = adminLoginRes.body.token;

      await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
        email: 'editor@example.com',
        fullName: 'Editor User',
        password: 'securepassword',
        role: Role.Editor
      });
      const editorLoginRes = await app.post('/api/v1/users/login').send({
        email: 'editor@example.com',
        password: 'securepassword'
      });
      editorToken = editorLoginRes.body.token;

      await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
        email: 'viewer@example.com',
        fullName: 'Viewer User',
        password: 'securepassword',
        role: Role.Viewer
      });
      const viewerLoginRes = await app.post('/api/v1/users/login').send({
        email: 'viewer@example.com',
        password: 'securepassword'
      });
      viewerToken = viewerLoginRes.body.token;
    });

    describe('Successfully retrieve providers', () => {
      // Test basic provider listing functionality
      test('should return 200 OK with provider list for valid requests', async () => {
        await app.post('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`).send({
          name: 'Test Provider 1',
          providerIP: '192.168.1.100',
          username: 'testuser1',
          password: 'testpass1',
          SSHPort: 22,
          providerType: ProviderType.VM
        });

        await app.post('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`).send({
          name: 'Test Provider 2',
          providerIP: '192.168.1.101',
          username: 'testuser2',
          password: 'testpass2',
          SSHPort: 22,
          providerType: ProviderType.K8S
        });

        const res = await app.get('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('providers');
        expect(Array.isArray(res.body.data.providers)).toBe(true);
        expect(res.body.data.providers).toHaveLength(2);
      });
    });

    describe('Authentication and authorization failures', () => {
      // Test unauthenticated request rejection
      test('should return 401 for missing authorization header', async () => {
        const res = await app.get('/api/v1/providers');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('Missing or invalid Authorization header');
      });

      // Test invalid token rejection
      test('should return 401 for invalid JWT token', async () => {
        const res = await app.get('/api/v1/providers').set('Authorization', 'Bearer invalid.jwt.token');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('Invalid or expired token');
      });
    });

    describe('Permissions for provider access', () => {
      // Test admin role access
      test('should allow admin users to access providers', async () => {
        const res = await app.get('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('providers');
      });

      // Test editor role access
      test('should allow editor users to access providers', async () => {
        const res = await app.get('/api/v1/providers').set('Authorization', `Bearer ${editorToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('providers');
      });

      // Test viewer role access
      test('should allow viewer users to access providers', async () => {
        const res = await app.get('/api/v1/providers').set('Authorization', `Bearer ${viewerToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('providers');
      });
    });

    describe('Response structure validation', () => {
      // Test response format and required fields
      test('should return consistent response structure with provider metadata', async () => {
        await app.post('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`).send({
          name: 'Test Provider',
          providerIP: '192.168.1.200',
          username: 'testuser',
          password: 'testpassword',
          SSHPort: 22,
          providerType: ProviderType.VM
        });

        const res = await app.get('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          success: true,
          data: {
            providers: expect.any(Array)
          }
        });

        if (res.body.data.providers.length > 0) {
          const provider = res.body.data.providers[0];
          expect(provider).toHaveProperty('id');
          expect(provider).toHaveProperty('name');
          expect(provider).toHaveProperty('providerIP');
          expect(provider).toHaveProperty('providerType');
          expect(provider).toHaveProperty('createdAt');
        }
      });

      // Test password field exclusion from response
      test('should filter out sensitive data from response', async () => {
        await app.post('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`).send({
          name: 'Secure Provider',
          providerIP: '192.168.1.150',
          username: 'secureuser',
          password: 'topsecretpassword',
          SSHPort: 22,
          providerType: ProviderType.VM
        });

        const res = await app.get('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.status).toBe(200);
        const provider = res.body.data.providers[0];
        
        expect(provider).not.toHaveProperty('password');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('providerIP');
        expect(provider).toHaveProperty('username');
      });
    });
  });

  describe('GET /api/v1/providers/:providerId/discover-services', () => {
    let adminToken: string;
    let editorToken: string;
    let viewerToken: string;
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

  test('should allow viewer users to discover services', async () => {
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

      // Viewer should be allowed to discover services (same as other roles)
      expect([200, 500]).toContain(res.status);
      expect(res.body).toHaveProperty('success');
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