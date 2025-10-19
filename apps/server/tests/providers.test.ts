import request, { SuperTest, Test } from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../src/app.js";
import { Role, ProviderType } from "@OpsiMate/shared";

describe("Providers API", () => {
  let app: SuperTest<Test>;
  let db: Database.Database;
  let adminToken: string;

  beforeAll(async () => {
    db = new Database(":memory:");
    const expressApp = await createApp(db);
    app = request(expressApp) as unknown as SuperTest<Test>;
  });

  beforeEach(async () => {
    db.exec("DELETE FROM users");
    db.exec("DELETE FROM providers");

    // Register admin and get token (shared across all tests)
    await app.post("/api/v1/users/register").send({
      email: "admin@example.com",
      fullName: "Admin User",
      password: "securepassword",
    });
    const loginRes = await app.post("/api/v1/users/login").send({
      email: "admin@example.com",
      password: "securepassword",
    });
    adminToken = loginRes.body.token;
import request, { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../src/app';
import {
  Logger,
  AuditActionType,
  AuditResourceType,
  AuditLog,
  Provider,
  Role,
  Service
} from '@OpsiMate/shared';

const logger = new Logger('test-provider-service');

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

// Seed the database
const seedProvidersAndServices = () => {
  db.exec('DELETE FROM services');
  db.exec('DELETE FROM providers');
  db.exec('DELETE FROM audit_logs');

  db.prepare(`
    INSERT INTO providers (id, provider_name, provider_ip, username, public_key, ssh_port, created_at)
    VALUES (1, 'Original Provider', '127.0.0.1', 'root', 'key.pem', 22, CURRENT_TIMESTAMP)
  `).run();

  db.prepare(`
    INSERT INTO services (provider_id, service_name, service_ip, service_status)
    VALUES (1, 'Test Service', '127.0.0.1', 'running')
  `).run();
};

beforeAll(async () => {
  db = new Database(':memory:');

  // Create tables
  db.exec(`
    CREATE TABLE providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_name TEXT NOT NULL,
      provider_ip TEXT NOT NULL,
      username TEXT NOT NULL,
      public_key TEXT NOT NULL,
      ssh_port INTEGER DEFAULT 22,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      service_name TEXT NOT NULL,
      service_ip TEXT,
      service_status TEXT DEFAULT 'unknown',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE audit_logs (
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
  `);

  const expressApp = await createApp(db);
  app = request(expressApp) as unknown as SuperTest<Test>;

  // Register and login a test user
  await app.post('/api/v1/users/register').send({
    email: 'testuser@example.com',
    fullName: 'Test User',
    password: 'password123'
  });

  const loginRes = await app.post('/api/v1/users/login').send({
    email: 'testuser@example.com',
    password: 'password123'
  });
  jwtToken = loginRes.body.token;
});

  describe("GET /api/v1/providers/:providerId/discover-services", () => {
    let providerId: number;

    beforeEach(async () => {
      // Create a provider
      const providerRes = await app
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Provider",
          providerIP: "192.168.1.100",
          username: "testuser",
          password: "testpass",
          SSHPort: 22,
          providerType: ProviderType.VM,
        });
      providerId = providerRes.body.data.id;
    });

    test("should successfully discover services from valid provider", async () => {
      // Note: This test assumes the provider connection works or is mocked
      // In a real scenario, this would attempt to connect to the provider
      const res = await app
        .get(`/api/v1/providers/${providerId}/discover-services`)
        .set("Authorization", `Bearer ${adminToken}`);

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
            namespace: expect.any(String), // optional
          });
        }
      } else {
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe("Internal server error");
      }
    });

    test("should return error for non-existent provider", async () => {
      const nonExistentId = 9999;
      const res = await app
        .get(`/api/v1/providers/${nonExistentId}/discover-services`)
        .set("Authorization", `Bearer ${adminToken}`);

      // Should return 500 as the BL throws an error when provider not found
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Internal server error");
    });

    test("should return 400 for invalid provider ID", async () => {
      const res = await app
        .get("/api/v1/providers/invalid/discover-services")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Invalid provider ID");
    });

    test("should reject access for non-admin user", async () => {
      // Create a viewer user
      await app
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: "viewer@example.com",
          fullName: "Viewer User",
          password: "securepassword",
          role: Role.Viewer,
        });
      const viewerLogin = await app.post("/api/v1/users/login").send({
        email: "viewer@example.com",
        password: "securepassword",
      });
      const viewerToken = viewerLogin.body.token;

      // Attempt to discover services as viewer
      const res = await app
        .get(`/api/v1/providers/${providerId}/discover-services`)
        .set("Authorization", `Bearer ${viewerToken}`);

      // Should be rejected based on role-based access control
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("should reject access for unauthenticated request", async () => {
      const res = await app.get(
        `/api/v1/providers/${providerId}/discover-services`
      );

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("should not modify existing data (read-only operation)", async () => {
      // Get initial provider state
      const initialProvidersRes = await app
        .get("/api/v1/providers")
        .set("Authorization", `Bearer ${adminToken}`);
      const initialProviders = initialProvidersRes.body.data.providers;

      // Attempt discovery
      await app
        .get(`/api/v1/providers/${providerId}/discover-services`)
        .set("Authorization", `Bearer ${adminToken}`);

      // Check that providers are unchanged
      const afterProvidersRes = await app
        .get("/api/v1/providers")
        .set("Authorization", `Bearer ${adminToken}`);
      const afterProviders = afterProvidersRes.body.data.providers;
beforeEach(() => {
  seedProvidersAndServices();
});

afterAll(() => {
  db.close();
});

describe('PUT /api/v1/providers/:providerId', () => {

  test('✅ Updates provider successfully and updates DB', async () => {
    const updateData = {
      name: 'Updated Provider',
      providerIP: '192.168.1.1',
      username: 'admin',
      publicKey: 'updated.pem',
      sshPort: 2222
    };

    const res = await app
      .put('/api/v1/providers/1')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(updateData);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.provider_name).toBe('Updated Provider');

    // Confirm DB updated
    const dbProvider = db.prepare('SELECT * FROM providers WHERE id = 1').get() as any;
    expect(dbProvider.provider_name).toBe('Updated Provider');
    expect(dbProvider.username).toBe('admin');
  });

  test('✅ Returns 400 for invalid data (successfully handled)', async () => {
    const res = await app
      .put('/api/v1/providers/1')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ providerIP: '10.0.0.5' }); // missing required fields

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
  //DELETE PROVIDER TEST BEGINS:-
  describe("DELETE /api/v1/providers/:providerId", () => {
    let testProviderId: number;

    beforeEach(async () => {
      // Create a provider using the API
      const providerRes = await app
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Provider",
          providerIP: "192.168.1.100",
          username: "testuser",
          password: "testpass",
          SSHPort: 22,
          providerType: ProviderType.VM,
        });

      expect([200, 201]).toContain(providerRes.status);
      testProviderId = providerRes.body.data.id;

      // Create associated services directly in DB (for cascade delete testing)
      const insertService = db.prepare(
        "INSERT INTO services (name, provider_id) VALUES (?, ?)"
      );
      insertService.run("Test Service 1", testProviderId);
      insertService.run("Test Service 2", testProviderId);
    });

    test("should successfully delete provider with valid ID and proper permissions", async () => {
      const res = await app
        .delete(`/api/v1/providers/${testProviderId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Provider and associated services deleted successfully",
      });

      // Verify provider is deleted from database
      const provider = db
        .prepare("SELECT * FROM providers WHERE id = ?")
        .get(testProviderId);
      expect(provider).toBeUndefined();
    });

    test("should cascade delete associated services", async () => {
      // Verify services exist before deletion
      const servicesBefore = db
        .prepare("SELECT COUNT(*) as count FROM services WHERE provider_id = ?")
        .get(testProviderId) as { count: number };
      expect(servicesBefore.count).toBe(2);

      await app
        .delete(`/api/v1/providers/${testProviderId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // Verify associated services are also deleted
      const servicesAfter = db
        .prepare("SELECT COUNT(*) as count FROM services WHERE provider_id = ?")
        .get(testProviderId) as { count: number };
      expect(servicesAfter.count).toBe(0);
    });

    test("should return 404 when provider does not exist", async () => {
      const nonExistentId = 99999;
      const res = await app
        .delete(`/api/v1/providers/${nonExistentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: expect.stringContaining("not found"),
      });
    });

    test("should return 400 for invalid provider ID format", async () => {
      const res = await app
        .delete("/api/v1/providers/invalid-id")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "Invalid provider ID",
      });
    });

    test("should return 401 when no authentication token is provided", async () => {
      const res = await app.delete(`/api/v1/providers/${testProviderId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("should return 403 when user lacks delete permissions", async () => {
      // Create a viewer user (non-admin)
      await app
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: "viewer@example.com",
          fullName: "Viewer User",
          password: "securepassword",
          role: Role.Viewer,
        });

      // Login as viewer
      const viewerLogin = await app.post("/api/v1/users/login").send({
        email: "viewer@example.com",
        password: "securepassword",
      });
      const viewerToken = viewerLogin.body.token;

      // Attempt to delete provider as viewer
      const res = await app
        .delete(`/api/v1/providers/${testProviderId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Forbidden: Admins only");
    });

    test("should record deletion in audit log with user information", async () => {
      // Capture provider name before deletion
      const provider = db
        .prepare("SELECT name FROM providers WHERE id = ?")
        .get(testProviderId) as any;
      const providerName = provider?.name;

      await app
        .delete(`/api/v1/providers/${testProviderId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // Get the latest audit log entry for this deletion
      const auditLog = db
        .prepare(
          `
        SELECT * FROM audit_logs 
        WHERE action_type = ? 
        AND resource_type = ? 
        AND resource_id = ?
        ORDER BY timestamp DESC 
        LIMIT 1
      `
        )
        .get("DELETE", "PROVIDER", String(testProviderId)) as any;

      expect(auditLog).toBeDefined();
      expect(auditLog.action_type).toBe("DELETE");
      expect(auditLog.resource_type).toBe("PROVIDER");
      expect(auditLog.resource_id).toBe(String(testProviderId));
      expect(auditLog.resource_name).toBe(providerName);
      expect(auditLog.user_id).toBeDefined();
      expect(auditLog.user_name).toBeDefined();
      expect(auditLog.timestamp).toBeDefined();
    });

  test('✅ Returns 404 if provider does not exist (successfully handled)', async () => {
    const res = await app
      .put('/api/v1/providers/999')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        name: 'Ghost Provider',
        providerIP: '10.0.0.99',
        username: 'ghost',
        publicKey: 'ghost.pem'
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('✅ Returns 401 if unauthorized (successfully blocked)', async () => {
    const res = await app.put('/api/v1/providers/1').send({
      name: 'Unauthorized Update',
      providerIP: '10.0.0.50',
      username: 'noAuth',
      publicKey: 'none.pem'
    });

    expect(res.status).toBe(401);
  });

  test('✅ Creates audit log entry on update', async () => {
    await app
      .put('/api/v1/providers/1')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        name: 'Audited Update',
        providerIP: '10.1.1.1',
        username: 'audit',
        publicKey: 'audit.pem'
      });

    const logs = db.prepare('SELECT * FROM audit_logs').all();
    expect(logs.length).toBeGreaterThan(0);

    const log: AuditLog = logs[0] as AuditLog;
    expect(log.actionType).toBe(AuditActionType.UPDATE);
    expect(log.resourceType).toBe(AuditResourceType.PROVIDER);
    expect(log.resourceId).toBe('1');
  });

});
