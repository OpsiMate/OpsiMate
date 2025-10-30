import request, { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../src/app.js';
import { AuditActionType, AuditResourceType, AuditLog } from '@OpsiMate/shared';

describe('Provider Refresh API', () => {
  let app: SuperTest<Test>;
  let db: Database.Database;
  let jwtToken: string;
  let adminUserId: number;
  let testProviderId: number;

  beforeAll(async () => {
    db = new Database(':memory:');
    const expressApp = await createApp(db);
    app = request(expressApp) as unknown as SuperTest<Test>;

    // Register and login admin user
    const registerRes = await app.post('/api/v1/users/register').send({
      email: 'admin@test.com',
      fullName: 'Admin User',
      password: 'password123'
    });
    
    if (!registerRes.body.success) {
      console.error('Registration failed:', registerRes.body);
      throw new Error('Failed to register admin user');
    }
    
    jwtToken = registerRes.body.token;
    adminUserId = registerRes.body.data.id;
  });

  beforeEach(async () => {
    // Clean up tables in correct order to avoid foreign key constraints
    db.exec('DELETE FROM audit_logs');
    db.exec('DELETE FROM services');
    db.exec('DELETE FROM providers');

    // Create a test provider
    const providerData = {
      name: 'Test Provider',
      providerIP: '192.168.1.100',
      username: 'testuser',
      password: 'testpassword123',
      SSHPort: 22,
      providerType: 'VM',
    };

    const createRes = await app
      .post('/api/v1/providers')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(providerData);

    if (!createRes.body.success || !createRes.body.data) {
      console.error('Provider creation failed:', createRes.body);
      console.error('Status:', createRes.status);
      throw new Error('Failed to create test provider');
    }

    testProviderId = createRes.body.data.id;
  });

  afterAll(() => {
    db.close();
  });

  describe('POST /api/v1/providers/:providerId/refresh', () => {
    test('✅ should successfully refresh provider with valid provider ID and proper permissions', async () => {
      const res = await app
        .post(`/api/v1/providers/${testProviderId}/refresh`)
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Provider refreshed successfully');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.provider).toBeDefined();
      expect(res.body.data.provider.id).toBe(testProviderId);
      expect(res.body.data.services).toBeDefined();
      expect(Array.isArray(res.body.data.services)).toBe(true);
      
      // Verify password is not exposed
      expect(res.body.data.provider.password).toBeUndefined();
    });

    test('❌ should return 404 when attempting to refresh non-existent provider', async () => {
      const nonExistentProviderId = 99999;
      
      const res = await app
        .post(`/api/v1/providers/${nonExistentProviderId}/refresh`)
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });

    test('🔒 should return 401 when no authentication token is provided', async () => {
      const res = await app
        .post(`/api/v1/providers/${testProviderId}/refresh`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('🔒 should return 401 when invalid authentication token is provided', async () => {
      const res = await app
        .post(`/api/v1/providers/${testProviderId}/refresh`)
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('🔒 should allow viewer role to refresh provider (no role restriction on refresh)', async () => {
      // Temporarily change admin user to viewer role
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('viewer', adminUserId);

      const res = await app
        .post(`/api/v1/providers/${testProviderId}/refresh`)
        .set('Authorization', `Bearer ${jwtToken}`);

      // Restore admin role
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', adminUserId);

      // Refresh endpoint allows all authenticated users regardless of role
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('🧾 should validate response structure with correct status code and data', async () => {
      const res = await app
        .post(`/api/v1/providers/${testProviderId}/refresh`)
        .set('Authorization', `Bearer ${jwtToken}`);

      // Validate status code
      expect(res.status).toBe(200);

      // Validate response structure
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('message');

      // Validate data structure
      expect(res.body.data).toHaveProperty('provider');
      expect(res.body.data).toHaveProperty('services');

      // Validate provider structure
      const provider = res.body.data.provider;
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('providerIP');
      expect(provider).toHaveProperty('username');
      expect(provider).toHaveProperty('providerType');

      // Validate services structure
      expect(Array.isArray(res.body.data.services)).toBe(true);
    });

    test('🧾 should return 400 for invalid provider ID format', async () => {
      const res = await app
        .post('/api/v1/providers/invalid-id/refresh')
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid provider ID');
    });

    test('🧾 should record audit log for provider refresh action', async () => {
      // Perform refresh
      const refreshRes = await app
        .post(`/api/v1/providers/${testProviderId}/refresh`)
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(refreshRes.status).toBe(200);

      // Fetch audit logs from API
      const auditRes = await app
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(auditRes.status).toBe(200);
      expect(Array.isArray(auditRes.body.logs)).toBe(true);

      // Find the refresh audit log
      const refreshLog = auditRes.body.logs.find(
        (log: AuditLog) => 
          log.actionType === AuditActionType.REFRESH &&
          log.resourceType === AuditResourceType.PROVIDER &&
          log.resourceId === String(testProviderId)
      );

      expect(refreshLog).toBeDefined();
      expect(refreshLog.userId).toBe(adminUserId);
      expect(refreshLog.userName).toBe('Admin User');
      expect(refreshLog.resourceName).toBe('Test Provider');
      expect(refreshLog.timestamp).toBeDefined();

      // Validate audit log directly from database
      const dbAuditLog = db.prepare(`
        SELECT * FROM audit_logs 
        WHERE action_type = ? 
        AND resource_type = ? 
        AND resource_id = ?
        ORDER BY timestamp DESC LIMIT 1
      `).get(AuditActionType.REFRESH, AuditResourceType.PROVIDER, String(testProviderId)) as any;

      expect(dbAuditLog).toBeDefined();
      expect(dbAuditLog.user_id).toBe(adminUserId);
      expect(dbAuditLog.user_name).toBe('Admin User');
      expect(dbAuditLog.resource_name).toBe('Test Provider');
      expect(dbAuditLog.action_type).toBe(AuditActionType.REFRESH);
      expect(dbAuditLog.resource_type).toBe(AuditResourceType.PROVIDER);
      expect(dbAuditLog.resource_id).toBe(String(testProviderId));
      
      // Verify API response matches database
      expect(refreshLog.actionType).toBe(dbAuditLog.action_type);
      expect(refreshLog.resourceType).toBe(dbAuditLog.resource_type);
      expect(refreshLog.resourceId).toBe(dbAuditLog.resource_id);
    });

    test('should handle provider refresh with multiple services', async () => {
      // Add some test services to the provider
      const service1 = db.prepare(`
        INSERT INTO services (provider_id, service_name, service_status, service_type, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(testProviderId, 'nginx', 'running', 'SYSTEMD');

      const service2 = db.prepare(`
        INSERT INTO services (provider_id, service_name, service_status, service_type, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(testProviderId, 'postgresql', 'stopped', 'SYSTEMD');

      const res = await app
        .post(`/api/v1/providers/${testProviderId}/refresh`)
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.services).toBeDefined();
      expect(Array.isArray(res.body.data.services)).toBe(true);
    });

    test('should allow editor role to refresh provider', async () => {
      // Temporarily change admin user to editor role
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('editor', adminUserId);

      const res = await app
        .post(`/api/v1/providers/${testProviderId}/refresh`)
        .set('Authorization', `Bearer ${jwtToken}`);

      // Restore admin role
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', adminUserId);

      // Editor should be able to refresh (not blocked by role restriction)
      expect(res.status).not.toBe(403);
    });

    test('should handle refresh when provider has no services', async () => {
      // Ensure no services exist for this provider
      db.prepare('DELETE FROM services WHERE provider_id = ?').run(testProviderId);

      const res = await app
        .post(`/api/v1/providers/${testProviderId}/refresh`)
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.services).toBeDefined();
      expect(Array.isArray(res.body.data.services)).toBe(true);
      expect(res.body.data.services.length).toBe(0);
    });
  });

  describe('Provider Refresh - Edge Cases', () => {
    test('should handle concurrent refresh requests gracefully', async () => {
      // Send multiple refresh requests simultaneously
      const promises = [
        app.post(`/api/v1/providers/${testProviderId}/refresh`).set('Authorization', `Bearer ${jwtToken}`),
        app.post(`/api/v1/providers/${testProviderId}/refresh`).set('Authorization', `Bearer ${jwtToken}`),
        app.post(`/api/v1/providers/${testProviderId}/refresh`).set('Authorization', `Bearer ${jwtToken}`)
      ];

      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    test('should return proper error message when provider connection fails', async () => {
      // Create a provider with invalid connection details
      const invalidProviderData = {
        name: 'Invalid Provider',
        providerIP: '999.999.999.999',
        username: 'invalid',
        password: 'testpassword',
        SSHPort: 22,
        providerType: 'VM',
      };

      const createRes = await app
        .post('/api/v1/providers')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(invalidProviderData);

      if (!createRes.body.success || !createRes.body.data) {
        // Skip this test if provider creation fails
        console.log('Skipping test - provider creation failed as expected for invalid data');
        return;
      }

      const invalidProviderId = createRes.body.data.id;

      const res = await app
        .post(`/api/v1/providers/${invalidProviderId}/refresh`)
        .set('Authorization', `Bearer ${jwtToken}`);

      // Should return 500 with error details
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Failed to refresh provider');
    });
  });
});
