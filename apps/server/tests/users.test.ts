import request, { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../src/app.js';
import { Role } from '@OpsiMate/shared';

describe('Users API', () => {
  let app: SuperTest<Test>;
  let db: Database.Database;

  beforeAll(async () => {
    db = new Database(':memory:');
    const expressApp = await createApp(db);
    app = request(expressApp) as unknown as SuperTest<Test>;
  });

  beforeEach(() => {
    db.exec('DELETE FROM users');
  });

  afterAll(() => {
    db.close();
  });

  describe('GET /api/v1/users', () => {
    test('should successfully retrieve all users as an admin', async () => {
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
      const adminToken = loginRes.body.token;

      // Get all users
      const res = await app.get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]).toMatchObject({
        id: expect.any(Number),
        email: 'admin@example.com',
        fullName: 'Admin User',
        role: Role.Admin,
        createdAt: expect.any(String),
      });
      // Ensure no sensitive data like password
      expect(res.body.data[0]).not.toHaveProperty('password');
    });

    test('should reject access for non-admin user', async () => {
      // Register admin first
      await app.post('/api/v1/users/register').send({
        email: 'admin@example.com',
        fullName: 'Admin User',
        password: 'securepassword'
      });
      const adminLogin = await app.post('/api/v1/users/login').send({
        email: 'admin@example.com',
        password: 'securepassword'
      });
      const adminToken = adminLogin.body.token;

      // Create a viewer user
      await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
        email: 'viewer@example.com',
        fullName: 'Viewer User',
        password: 'securepassword',
        role: Role.Viewer
      });

      // Login as viewer
      const viewerLogin = await app.post('/api/v1/users/login').send({
        email: 'viewer@example.com',
        password: 'securepassword'
      });
      const viewerToken = viewerLogin.body.token;

      // Attempt to get all users as viewer
      const res = await app.get('/api/v1/users').set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Forbidden: Admins only');
    });

    test('should reject access for unauthenticated request', async () => {
      const res = await app.get('/api/v1/users');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('should return multiple users correctly', async () => {
      // Register admin
      await app.post('/api/v1/users/register').send({
        email: 'admin@example.com',
        fullName: 'Admin User',
        password: 'securepassword'
      });
      const adminLogin = await app.post('/api/v1/users/login').send({
        email: 'admin@example.com',
        password: 'securepassword'
      });
      const adminToken = adminLogin.body.token;

      // Create additional users
      await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
        email: 'editor@example.com',
        fullName: 'Editor User',
        password: 'securepassword',
        role: Role.Editor
      });
      await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
        email: 'viewer@example.com',
        fullName: 'Viewer User',
        password: 'securepassword',
        role: Role.Viewer
      });

      // Get all users
      const res = await app.get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);

      // Check that all users are present
      const emails = res.body.data.map((user: any) => user.email).sort();
      expect(emails).toEqual(['admin@example.com', 'editor@example.com', 'viewer@example.com']);
    });
  });
});