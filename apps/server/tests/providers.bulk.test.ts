// Import necessary libraries and modules
import request, { SuperTest, Test } from 'supertest'; // supertest is used to make HTTP requests to the API
import Database from 'better-sqlite3'; // in-memory database for testing
import { createApp } from '../src/app'; // function to create and configure Express app
import { Role, ProviderType } from '@OpsiMate/shared'; // shared enums for user roles and provider types

// Group all tests related to Providers API bulk creation
describe('Providers API - Bulk Create', () => {
  let app: SuperTest<Test>; // supertest client for sending HTTP requests
  let db: Database.Database; // in-memory SQLite database
  let adminToken: string; // JWT token for admin user
  let viewerToken: string; // JWT token for viewer user (limited access)

  // Run once before all tests: setup app and users
  beforeAll(async () => {
    // Create in-memory database
    db = new Database(':memory:');

    // Create Express app instance with DB
    const expressApp = await createApp(db);

    // Initialize supertest client
    app = request(expressApp) as unknown as SuperTest<Test>;

    // ----------------------------
    // Register admin user
    // ----------------------------
    await app.post('/api/v1/users/register').send({
      email: 'admin@example.com',
      fullName: 'Admin User',
      password: 'securepassword'
    });

    // Login admin to get JWT token
    const loginRes = await app.post('/api/v1/users/login').send({
      email: 'admin@example.com',
      password: 'securepassword'
    });
    adminToken = loginRes.body.token;

    // ----------------------------
    // Register a viewer user
    // ----------------------------
    await app.post('/api/v1/users/register').send({
      email: 'viewer@example.com',
      fullName: 'Viewer User',
      password: 'securepassword',
      role: Role.Viewer
    });

    // Login viewer to get JWT token
    const viewerLogin = await app.post('/api/v1/users/login').send({
      email: 'viewer@example.com',
      password: 'securepassword'
    });
    viewerToken = viewerLogin.body.token;
  });

  // Run before each test: reset database tables
  beforeEach(() => {
    db.exec('DELETE FROM users'); // remove all users
    db.exec('DELETE FROM providers'); // remove all providers
  });

  // Run after all tests: close database connection
  afterAll(() => {
    db.close();
  });

  // ----------------------------
  // Test 1: Successfully create multiple providers
  // ----------------------------
  test('should create multiple providers successfully', async () => {
    const payload = [
      {
        name: 'Provider 1',
        providerIP: '192.168.1.101',
        username: 'user1',
        password: 'pass1',
        SSHPort: 22,
        providerType: ProviderType.VM
      },
      {
        name: 'Provider 2',
        providerIP: '192.168.1.102',
        username: 'user2',
        password: 'pass2',
        SSHPort: 22,
        providerType: ProviderType.VM
      }
    ];

    // Send bulk create request as admin
    const res = await app.post('/api/v1/providers/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    // Assertions
    expect(res.status).toBe(201); // HTTP 201 Created
    expect(res.body.success).toBe(true); // success flag true
    expect(Array.isArray(res.body.data)).toBe(true); // response is array
    expect(res.body.data.length).toBe(payload.length); // all providers created
    expect(res.body.data[0]).toMatchObject({ name: 'Provider 1' }); // first provider matches payload
  });

  // ----------------------------
  // Test 2: Handle partial failures
  // ----------------------------
  test('should handle partial failures', async () => {
    const payload = [
      {
        name: 'Valid Provider',
        providerIP: '192.168.1.103',
        username: 'user3',
        password: 'pass3',
        SSHPort: 22,
        providerType: ProviderType.VM
      },
      {
        name: '', // Invalid provider (name required)
        providerIP: 'invalid-ip',
        username: 'user4',
        password: 'pass4',
        SSHPort: 22,
        providerType: ProviderType.VM
      }
    ];

    // Send bulk create request
    const res = await app.post('/api/v1/providers/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    // Assertions
    expect(res.status).toBe(400); // Bad request for invalid data
    expect(res.body.success).toBe(false); // failed
    expect(res.body.error).toBeDefined(); // error message exists
  });

  // ----------------------------
  // Test 3: Reject non-admin users
  // ----------------------------
  test('should reject non-admin users', async () => {
    const payload = [
      {
        name: 'Provider 1',
        providerIP: '192.168.1.101',
        username: 'user1',
        password: 'pass1',
        SSHPort: 22,
        providerType: ProviderType.VM
      }
    ];

    // Viewer tries to create providers
    const res = await app.post('/api/v1/providers/bulk')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(payload);

    // Assertions: HTTP 401 or 403
    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  // ----------------------------
  // Test 4: Reject unauthenticated requests
  // ----------------------------
  test('should reject unauthenticated requests', async () => {
    const payload = [
      {
        name: 'Provider 1',
        providerIP: '192.168.1.101',
        username: 'user1',
        password: 'pass1',
        SSHPort: 22,
        providerType: ProviderType.VM
      }
    ];

    // Send request without token
    const res = await app.post('/api/v1/providers/bulk').send(payload);

    // Assertions
    expect(res.status).toBe(401); // Unauthorized
    expect(res.body.success).toBe(false);
  });

  // ----------------------------
  // Test 5: Database should reflect only valid providers
  // ----------------------------
  test('database should reflect only valid providers after bulk create', async () => {
    const payload = [
      {
        name: 'Provider Valid',
        providerIP: '192.168.1.110',
        username: 'user10',
        password: 'pass10',
        SSHPort: 22,
        providerType: ProviderType.VM
      },
      {
        name: '', // Invalid provider
        providerIP: '192.168.1.111',
        username: 'user11',
        password: 'pass11',
        SSHPort: 22,
        providerType: ProviderType.VM
      }
    ];

    // Send bulk request, ignore error for invalid provider
    await app.post('/api/v1/providers/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .catch(() => {});

    // Fetch all providers from API
    const dbRes = await app.get('/api/v1/providers')
      .set('Authorization', `Bearer ${adminToken}`);

    // Assertions: valid provider exists
    expect(dbRes.body.data.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Provider Valid' })
      ])
    );

    // Assertions: invalid provider not persisted
    expect(dbRes.body.data.providers).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '' })
      ])
    );
  });
});
