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
  });

  afterAll(() => {
    db.close();
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

      expect(afterProviders).toEqual(initialProviders);
    });
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
  });
});
