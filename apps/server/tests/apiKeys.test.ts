import request, { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../src/app.js';
import { Role } from '@OpsiMate/shared';
import crypto from 'crypto';

describe('API Keys API', () => {
  let app: SuperTest<Test>;
  let db: Database.Database;
  let adminToken: string;
  let editorToken: string;
  let viewerToken: string;
  let adminUserId: number;
  let editorUserId: number;
  let viewerUserId: number;

  beforeAll(async () => {
    db = new Database(':memory:');
    const expressApp = await createApp(db);
    app = request(expressApp) as unknown as SuperTest<Test>;

    // Register admin user
    await app.post('/api/v1/users/register').send({
      email: 'admin@example.com',
      fullName: 'Admin User',
      password: 'securepassword',
    });

    const adminLoginRes = await app.post('/api/v1/users/login').send({
      email: 'admin@example.com',
      password: 'securepassword',
    });
    adminToken = adminLoginRes.body.token;
    adminUserId = adminLoginRes.body.data.id;

    // Create editor user
    const editorRes = await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
      email: 'editor@example.com',
      fullName: 'Editor User',
      password: 'securepassword',
      role: Role.Editor,
    });
    editorUserId = editorRes.body.data.id;

    const editorLoginRes = await app.post('/api/v1/users/login').send({
      email: 'editor@example.com',
      password: 'securepassword',
    });
    editorToken = editorLoginRes.body.token;

    // Create viewer user
    const viewerRes = await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
      email: 'viewer@example.com',
      fullName: 'Viewer User',
      password: 'securepassword',
      role: Role.Viewer,
    });
    viewerUserId = viewerRes.body.data.id;

    const viewerLoginRes = await app.post('/api/v1/users/login').send({
      email: 'viewer@example.com',
      password: 'securepassword',
    });
    viewerToken = viewerLoginRes.body.token;
  });

  beforeEach(() => {
    // Clear API keys for each test
    db.exec('DELETE FROM api_keys');
  });

  afterAll(() => {
    db.close();
  });

  describe('POST /api/v1/api-keys', () => {
    test('should create API key successfully', async () => {
      const res = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test API Key',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test API Key');
      expect(res.body.data.userId).toBe(adminUserId);
      expect(res.body.data.key).toBeDefined();
      expect(res.body.data.key).toMatch(/^om_/); // Should start with prefix
      expect(res.body.data.isActive).toBe(true);
    });

    test('should create API key with expiration date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const expiresAt = futureDate.toISOString();

      const res = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Expiring API Key',
          expiresAt,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Expiring API Key');
      expect(res.body.data.expiresAt).toBe(expiresAt);
    });

    test('should reject API key with past expiration date', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      const expiresAt = pastDate.toISOString();

      const res = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid API Key',
          expiresAt,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Expiration date must be in the future');
    });

    test('should reject API key with empty name', async () => {
      const res = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should reject API key without authentication', async () => {
      const res = await app.post('/api/v1/api-keys')
        .send({
          name: 'Test API Key',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/api-keys', () => {
    test('should get all API keys for user', async () => {
      // Create some API keys
      await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Key 1' });

      await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Key 2' });

      const res = await app.get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Key 2'); // Should be ordered by created_at DESC
      expect(res.body.data[1].name).toBe('Key 1');
    });

    test('should return empty array when no API keys exist', async () => {
      const res = await app.get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    test('should only return API keys for the authenticated user', async () => {
      // Create API key for admin
      await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Key' });

      // Create API key for editor
      await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ name: 'Editor Key' });

      // Get API keys for admin
      const adminRes = await app.get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data).toHaveLength(1);
      expect(adminRes.body.data[0].name).toBe('Admin Key');

      // Get API keys for editor
      const editorRes = await app.get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${editorToken}`);

      expect(editorRes.status).toBe(200);
      expect(editorRes.body.data).toHaveLength(1);
      expect(editorRes.body.data[0].name).toBe('Editor Key');
    });
  });

  describe('GET /api/v1/api-keys/:apiKeyId', () => {
    test('should get specific API key', async () => {
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Key' });

      const apiKeyId = createRes.body.data.id;

      const res = await app.get(`/api/v1/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Key');
      expect(res.body.data.userId).toBe(adminUserId);
    });

    test('should return 404 for non-existent API key', async () => {
      const res = await app.get('/api/v1/api-keys/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test('should not allow access to other users API keys', async () => {
      // Create API key for editor
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ name: 'Editor Key' });

      const apiKeyId = createRes.body.data.id;

      // Try to access with admin token
      const res = await app.get(`/api/v1/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/api-keys/:apiKeyId', () => {
    test('should update API key name', async () => {
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Original Name' });

      const apiKeyId = createRes.body.data.id;

      const res = await app.put(`/api/v1/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
    });

    test('should update API key active status', async () => {
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Key' });

      const apiKeyId = createRes.body.data.id;

      const res = await app.put(`/api/v1/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);
    });

    test('should update both name and active status', async () => {
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Original Name' });

      const apiKeyId = createRes.body.data.id;

      const res = await app.put(`/api/v1/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          name: 'Updated Name',
          isActive: false 
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.isActive).toBe(false);
    });

    test('should not allow updating other users API keys', async () => {
      // Create API key for editor
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ name: 'Editor Key' });

      const apiKeyId = createRes.body.data.id;

      // Try to update with admin token
      const res = await app.put(`/api/v1/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/api-keys/:apiKeyId', () => {
    test('should delete API key successfully', async () => {
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'To Delete' });

      const apiKeyId = createRes.body.data.id;

      const res = await app.delete(`/api/v1/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      // Verify it's deleted
      const getRes = await app.get(`/api/v1/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(404);
    });

    test('should not allow deleting other users API keys', async () => {
      // Create API key for editor
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ name: 'Editor Key' });

      const apiKeyId = createRes.body.data.id;

      // Try to delete with admin token
      const res = await app.delete(`/api/v1/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('API Key Authentication', () => {
    test('should authenticate with valid API key', async () => {
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Auth Test Key' });

      const apiKey = createRes.body.data.key;

      // Use API key to access protected endpoint
      const res = await app.get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should reject invalid API key', async () => {
      const res = await app.get('/api/v1/api-keys')
        .set('Authorization', 'Bearer invalid_key');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid or expired API key');
    });

    test('should reject expired API key', async () => {
      const pastDate = new Date();
      pastDate.setSeconds(pastDate.getSeconds() - 1); // 1 second ago
      const expiresAt = pastDate.toISOString();

      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          name: 'Expired Key',
          expiresAt 
        });

      const apiKey = createRes.body.data.key;

      // Wait a moment to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const res = await app.get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid or expired API key');
    });

    test('should reject inactive API key', async () => {
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Inactive Key' });

      const apiKeyId = createRes.body.data.id;
      const apiKey = createRes.body.data.key;

      // Deactivate the API key
      await app.put(`/api/v1/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      const res = await app.get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid or expired API key');
    });

    test('should update last used timestamp when API key is used', async () => {
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Usage Test Key' });

      const apiKeyId = createRes.body.data.id;
      const apiKey = createRes.body.data.key;

      // Use the API key
      await app.get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${apiKey}`);

      // Check that lastUsedAt was updated
      const res = await app.get(`/api/v1/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.lastUsedAt).toBeDefined();
      expect(new Date(res.body.data.lastUsedAt)).toBeInstanceOf(Date);
    });

    test('should respect role permissions with API key authentication', async () => {
      // Create API key for viewer
      const createRes = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Viewer Key' });

      const apiKey = createRes.body.data.key;

      // Try to create a provider (should be forbidden for viewers)
      const res = await app.post('/api/v1/providers')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          name: 'Test Provider',
          providerIP: '192.168.1.100',
          username: 'testuser',
          password: 'testpass',
          providerType: 'VM',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Forbidden: Viewer users cannot edit data');
    });
  });

  describe('Edge Cases', () => {
    test('should handle API key with very long name', async () => {
      const longName = 'A'.repeat(100); // Max length is 100

      const res = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: longName });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(longName);
    });

    test('should reject API key with name exceeding max length', async () => {
      const tooLongName = 'A'.repeat(101); // Exceeds max length of 100

      const res = await app.post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: tooLongName });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should handle concurrent API key creation', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        app.post('/api/v1/api-keys')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: `Concurrent Key ${i}` })
      );

      const results = await Promise.all(promises);

      results.forEach((res, i) => {
        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe(`Concurrent Key ${i}`);
      });

      // Verify all keys were created
      const getRes = await app.get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.body.data).toHaveLength(5);
    });
  });
});
