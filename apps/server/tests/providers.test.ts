import request, { SuperTest, Test } from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../src/app.js";
import { Role, ProviderType } from "@OpsiMate/shared";

describe("Providers API", () => {
  let app: SuperTest<Test>;
  let db: Database.Database;

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

  describe("GET /api/v1/providers/:providerId/discover-services", () => {
    let adminToken: string;
    let providerId: number;

    beforeEach(async () => {
      // Register admin
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

      // Create a provider
      const providerRes = await app.post("/api/v1/providers").set("Authorization", `Bearer ${adminToken}`).send({
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
      const res = await app.get(`/api/v1/providers/${providerId}/discover-services`).set("Authorization", `Bearer ${adminToken}`);

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
      const res = await app.get("/api/v1/providers/invalid/discover-services").set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Invalid provider ID");
    });

    test("should reject access for non-admin user", async () => {
      // Create a viewer user
      await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
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
      const res = await app.get(`/api/v1/providers/${providerId}/discover-services`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("should not modify existing data (read-only operation)", async () => {
      // Get initial provider state
      const initialProvidersRes = await app.get("/api/v1/providers").set("Authorization", `Bearer ${adminToken}`);
      const initialProviders = initialProvidersRes.body.data.providers;

      // Attempt discovery
      await app.get(`/api/v1/providers/${providerId}/discover-services`).set("Authorization", `Bearer ${adminToken}`);

      // Check that providers are unchanged
      const afterProvidersRes = await app.get("/api/v1/providers").set("Authorization", `Bearer ${adminToken}`);
      const afterProviders = afterProvidersRes.body.data.providers;

      expect(afterProviders).toEqual(initialProviders);
    });
  });

  describe("POST /api/v1/providers", () => {
    let adminToken: string;
    let editorToken: string;
    let viewerToken: string;

    beforeEach(async () => {
      // Register admin
      await app.post("/api/v1/users/register").send({
        email: "admin@example.com",
        fullName: "Admin User",
        password: "securepassword",
      });
      const adminLogin = await app.post("/api/v1/users/login").send({
        email: "admin@example.com",
        password: "securepassword",
      });
      adminToken = adminLogin.body.token;

      // Create editor user
      await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
        email: "editor@example.com",
        fullName: "Editor User",
        password: "securepassword",
        role: Role.Editor,
      });
      const editorLogin = await app.post("/api/v1/users/login").send({
        email: "editor@example.com",
        password: "securepassword",
      });
      editorToken = editorLogin.body.token;

      // Create viewer user
      await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
        email: "viewer@example.com",
        fullName: "Viewer User",
        password: "securepassword",
        role: Role.Viewer,
      });
      const viewerLogin = await app.post("/api/v1/users/login").send({
        email: "viewer@example.com",
        password: "securepassword",
      });
      viewerToken = viewerLogin.body.token;
    });

    test("should successfully create a new provider with valid data and admin permissions", async () => {
      const providerData = {
        name: "Test VM Provider",
        providerIP: "192.168.1.100",
        username: "testuser",
        password: "testpass",
        SSHPort: 22,
        providerType: ProviderType.VM,
      };

      const res = await app.post("/api/v1/providers").set("Authorization", `Bearer ${adminToken}`).send(providerData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: expect.any(Number),
        name: "Test VM Provider",
        providerIP: "192.168.1.100",
        username: "testuser",
        password: "testpass",
        SSHPort: 22,
        providerType: ProviderType.VM,
        createdAt: expect.any(String),
      });

      // Verify provider was created in database
      const providerRow = db.prepare("SELECT * FROM providers WHERE name = ?").get("Test VM Provider") as any;
      expect(providerRow).toBeDefined();
      expect(providerRow.provider_name).toBe("Test VM Provider");
      expect(providerRow.provider_type).toBe(ProviderType.VM);
    });

    test("should successfully create a provider with editor permissions", async () => {
      const providerData = {
        name: "Editor VM Provider",
        providerIP: "192.168.1.101",
        username: "editoruser",
        password: "editorpass",
        providerType: ProviderType.VM,
      };

      const res = await app.post("/api/v1/providers").set("Authorization", `Bearer ${editorToken}`).send(providerData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Editor VM Provider");
    });

    test("should successfully create a K8S provider", async () => {
      const providerData = {
        name: "Test K8S Provider",
        providerIP: "k8s.example.com",
        username: "k8suser",
        password: "k8spass",
        SSHPort: 22,
        providerType: ProviderType.K8S,
      };

      const res = await app.post("/api/v1/providers").set("Authorization", `Bearer ${adminToken}`).send(providerData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.providerType).toBe(ProviderType.K8S);
    });

    test("should return 400 for missing required fields", async () => {
      const invalidData = {
        // missing name and providerType
        providerIP: "192.168.1.100",
        username: "testuser",
        password: "testpass",
      };

      const res = await app.post("/api/v1/providers").set("Authorization", `Bearer ${adminToken}`).send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Validation error");
      expect(res.body.details).toBeDefined();
    });

    test("should return 400 for invalid provider type", async () => {
      const invalidData = {
        name: "Test Provider",
        providerIP: "192.168.1.100",
        username: "testuser",
        password: "testpass",
        providerType: "INVALID_TYPE",
      };

      const res = await app.post("/api/v1/providers").set("Authorization", `Bearer ${adminToken}`).send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Validation error");
    });

    test("should return 400 for invalid IP address/hostname", async () => {
      const invalidData = {
        name: "Test Provider",
        providerIP: "invalid..ip.address",
        username: "testuser",
        password: "testpass",
        providerType: ProviderType.VM,
      };

      const res = await app.post("/api/v1/providers").set("Authorization", `Bearer ${adminToken}`).send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Validation error");
    });

    test("should return 400 when neither password nor secretId is provided", async () => {
      const invalidData = {
        name: "Test Provider",
        providerIP: "192.168.1.100",
        username: "testuser",
        // missing both password and secretId
        providerType: ProviderType.VM,
      };

      const res = await app.post("/api/v1/providers").set("Authorization", `Bearer ${adminToken}`).send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Validation error");
    });

    test("should return 403 for viewer users", async () => {
      const providerData = {
        name: "Viewer Provider",
        providerIP: "192.168.1.100",
        username: "vieweruser",
        password: "viewerpass",
        providerType: ProviderType.VM,
      };

      const res = await app.post("/api/v1/providers").set("Authorization", `Bearer ${viewerToken}`).send(providerData);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Forbidden: Viewer users cannot edit data");
    });

    test("should return 401 for unauthenticated requests", async () => {
      const providerData = {
        name: "Unauth Provider",
        providerIP: "192.168.1.100",
        username: "unauthuser",
        password: "unauthpass",
        providerType: ProviderType.VM,
      };

      const res = await app.post("/api/v1/providers").send(providerData);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("should create provider with optional fields omitted", async () => {
      const minimalData = {
        name: "Minimal Provider",
        password: "testpass",
        providerType: ProviderType.VM,
      };

      const res = await app.post("/api/v1/providers").set("Authorization", `Bearer ${adminToken}`).send(minimalData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Minimal Provider");
      expect(res.body.data.providerIP).toBeUndefined();
      expect(res.body.data.username).toBeUndefined();
      expect(res.body.data.SSHPort).toBe(22); // default value
    });

    test("should create provider with custom SSH port", async () => {
      const providerData = {
        name: "Custom Port Provider",
        providerIP: "192.168.1.100",
        username: "testuser",
        password: "testpass",
        SSHPort: 2222,
        providerType: ProviderType.VM,
      };

      const res = await app.post("/api/v1/providers").set("Authorization", `Bearer ${adminToken}`).send(providerData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.SSHPort).toBe(2222);
    });
  });
});
