import request, { SuperTest, Test } from "supertest";
import Database from "better-sqlite3";
import { ProviderType, Role } from "@OpsiMate/shared";
import { createApp } from "../src/app.js";

describe("DELETE /api/v1/providers/:providerId", () => {
  let app: SuperTest<Test>;
  let db: Database.Database;
  let adminToken: string;
  let testProviderId: number;

  beforeAll(async () => {
    db = new Database(":memory:");
    const expressApp = await createApp(db);
    app = request(expressApp) as unknown as SuperTest<Test>;
  });

  beforeEach(() => {
    db.exec("DELETE FROM users");
    db.exec("DELETE FROM providers");
  });

  afterAll(() => {
    db.close();
  });
  beforeEach(async () => {
    // register an admin user and get token
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

    // create a provider using the API
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

    // create associated services directly in DB (for cascade delete testing)
    const insertService = db.prepare(
      "INSERT INTO services (name, provider_id) VALUES (?, ?)"
    );
    insertService.run("Test Service 1", testProviderId);
    insertService.run("Test Service 2", testProviderId);
  });

  describe("Successfully delete provider with valid provider ID and proper permissions", () => {
    test("should return 200 OK when deleting with valid ID", async () => {
      const res = await app
        .delete(`/api/v1/providers/${testProviderId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Provider and associated services deleted successfully",
      });
    });

    test("should properly remove provider from database", async () => {
      await app
        .delete(`/api/v1/providers/${testProviderId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // verify provider is deleted from database
      const provider = db
        .prepare("SELECT * FROM providers WHERE id = ?")
        .get(testProviderId);

      expect(provider).toBeUndefined();
    });

    test("should handle related services appropriately (cascade delete)", async () => {
      // verify services exist before deletion
      const servicesBefore = db
        .prepare("SELECT COUNT(*) as count FROM services WHERE provider_id = ?")
        .get(testProviderId) as { count: number };
      expect(servicesBefore.count).toBe(2);

      await app
        .delete(`/api/v1/providers/${testProviderId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // verify associated services are also deleted
      const servicesAfter = db
        .prepare("SELECT COUNT(*) as count FROM services WHERE provider_id = ?")
        .get(testProviderId) as { count: number };
      expect(servicesAfter.count).toBe(0);
    });
  });

  describe("Attempt to delete non-existent provider (should return 404)", () => {
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
  });

  describe("Verify correct permissions for provider deletion", () => {
    test("should return 401 when no authentication token is provided", async () => {
      const res = await app.delete(`/api/v1/providers/${testProviderId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("should return 401 with invalid authentication token", async () => {
      const res = await app
        .delete(`/api/v1/providers/${testProviderId}`)
        .set("Authorization", "Bearer invalid-token-here");

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

      // login as viewer
      const viewerLogin = await app.post("/api/v1/users/login").send({
        email: "viewer@example.com",
        password: "securepassword",
      });
      const viewerToken = viewerLogin.body.token;

      // attempt to delete provider as viewer
      const res = await app
        .delete(`/api/v1/providers/${testProviderId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Forbidden: Admins only");
    });
  });

  describe("Audit log records the provider deletion", () => {
    test("should record complete deletion audit log with user information", async () => {
      // capture provider name before deletion
      const provider = db
        .prepare("SELECT name FROM providers WHERE id = ?")
        .get(testProviderId) as any;
      const providerName = provider?.name;

      await app
        .delete(`/api/v1/providers/${testProviderId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // get the latest audit log entry for this deletion
      const auditLog = db
        .prepare(
          `SELECT * FROM audit_logs 
         WHERE action_type = ? 
         AND resource_type = ? 
         AND resource_id = ?
         ORDER BY timestamp DESC 
         LIMIT 1`
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
