import request, { SuperTest, Test } from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../src/app";
import { Role } from "@OpsiMate/shared";

describe("Users API", () => {
  let app: SuperTest<Test>;
  let db: Database.Database;
  let adminToken: string;

  beforeAll(async () => {
    db = new Database(":memory:");
    const expressApp = await createApp(db);
    app = request(expressApp) as unknown as SuperTest<Test>;

    // Register an admin user and get token
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

  beforeEach(() => {
    // Delete all users except the admin to keep a stable baseline
    db.exec("DELETE FROM users WHERE email != 'admin@example.com'");
  });

  afterAll(() => {
    db.close();
  });

  describe("POST /api/v1/users", () => {
    test("should successfully create a new user with valid data", async () => {
      const userData = {
        email: "newuser@example.com",
        fullName: "New User",
        password: "validpassword123",
        role: Role.Editor,
      };

      const res = await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send(userData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: expect.any(Number),
        email: "newuser@example.com",
        fullName: "New User",
        role: Role.Editor,
        createdAt: expect.any(String),
      });

      // Verify user was created in database
      const userRow = db.prepare("SELECT * FROM users WHERE email = ?").get("newuser@example.com") as any;
      expect(userRow).toBeDefined();
      expect(userRow.full_name).toBe("New User");
      expect(userRow.role).toBe(Role.Editor);
    });

    test("should return 403 for non-admin users", async () => {
      // Create an editor user (as admin)
      await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
        email: "editor@example.com",
        fullName: "Editor User",
        password: "password123",
        role: Role.Editor,
      });

      // Login as editor
      const loginRes = await app.post("/api/v1/users/login").send({
        email: "editor@example.com",
        password: "password123",
      });
      const editorToken = loginRes.body.token;

      // Try to create another user as editor
      const res = await app.post("/api/v1/users").set("Authorization", `Bearer ${editorToken}`).send({
        email: "another@example.com",
        fullName: "Another User",
        password: "password123",
        role: Role.Viewer,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Forbidden: Admins only");
    });

    test("should return 400 for missing required fields", async () => {
      const invalidData = {
        email: "test@example.com",
        // missing fullName, password, role
      };

      const res = await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Validation error");
      expect(res.body.details).toBeDefined();
    });

    test("should return 400 for invalid email format", async () => {
      const invalidData = {
        email: "invalid-email",
        fullName: "Test User",
        password: "password123",
        role: Role.Viewer,
      };

      const res = await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Validation error");
      expect(res.body.details).toBeDefined();
    });

    test("should return 400 for password too short", async () => {
      const invalidData = {
        email: "test@example.com",
        fullName: "Test User",
        password: "12345", // less than 6 characters
        role: Role.Viewer,
      };

      const res = await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Validation error");
      expect(res.body.details).toBeDefined();
    });

    test("should return 400 for duplicate email", async () => {
      // Create first user
      await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
        email: "duplicate@example.com",
        fullName: "First User",
        password: "password123",
        role: Role.Editor,
      });

      // Try to create second user with same email
      const res = await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
        email: "duplicate@example.com",
        fullName: "Second User",
        password: "password123",
        role: Role.Viewer,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Email already registered");
    });

    test("should return 401 for missing authorization", async () => {
      const userData = {
        email: "test@example.com",
        fullName: "Test User",
        password: "password123",
        role: Role.Viewer,
      };

      const res = await app.post("/api/v1/users").send(userData);

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/users", () => {
    test("should successfully retrieve all users as an admin", async () => {
      const res = await app.get("/api/v1/users").set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]).toMatchObject({
        id: expect.any(Number),
        email: "admin@example.com",
        fullName: "Admin User",
        role: Role.Admin,
        createdAt: expect.any(String),
      });
      // Ensure no sensitive data like password
      expect(res.body.data[0]).not.toHaveProperty("password");
    });

    test("should reject access for non-admin user", async () => {
      // Create a viewer user
      await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
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

      // Attempt to get all users as viewer
      const res = await app.get("/api/v1/users").set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Forbidden: Admins only");
    });

    test("should reject access for unauthenticated request", async () => {
      const res = await app.get("/api/v1/users");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("should return multiple users correctly", async () => {
      // Create additional users
      await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
        email: "editor@example.com",
        fullName: "Editor User",
        password: "securepassword",
        role: Role.Editor,
      });

      await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
        email: "viewer@example.com",
        fullName: "Viewer User",
        password: "securepassword",
        role: Role.Viewer,
      });

      // Get all users
      const res = await app.get("/api/v1/users").set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);

      // Check that all users are present
      const emails = res.body.data.map((u: any) => u.email).sort();
      expect(emails).toEqual([
        "admin@example.com",
        "editor@example.com",
        "viewer@example.com",
      ]);
    });
  });

  describe("PATCH /api/v1/users/role", () => {
    test("should successfully update user role with valid data and admin permissions", async () => {
      // Create a user to update
      await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
        email: "updateme@example.com",
        fullName: "Update Me",
        password: "password123",
        role: Role.Viewer,
      });

      // Update the user's role
      const updateData = {
        email: "updateme@example.com",
        newRole: Role.Editor,
      };

      const res = await app.patch("/api/v1/users/role").set("Authorization", `Bearer ${adminToken}`).send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User role updated successfully");

      // Verify the role was updated in the database
      const userRow = db.prepare("SELECT role FROM users WHERE email = ?").get("updateme@example.com") as any;
      expect(userRow.role).toBe(Role.Editor);
    });

    test("should return 400 for invalid role values", async () => {
      const invalidUpdateData = {
        email: "updateme@example.com",
        newRole: "invalid-role", // Invalid role value
      };

      const res = await app.patch("/api/v1/users/role").set("Authorization", `Bearer ${adminToken}`).send(invalidUpdateData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Validation error");
      expect(res.body.details).toBeDefined();
    });

    test("should return 400 for invalid email format", async () => {
      const invalidUpdateData = {
        email: "invalid-email-format",
        newRole: Role.Editor,
      };

      const res = await app.patch("/api/v1/users/role").set("Authorization", `Bearer ${adminToken}`).send(invalidUpdateData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Validation error");
      expect(res.body.details).toBeDefined();
    });

    test("should return 403 for non-admin users", async () => {
      // Create an editor user
      await app.post("/api/v1/users").set("Authorization", `Bearer ${adminToken}`).send({
        email: "editoruser@example.com",
        fullName: "Editor User",
        password: "password123",
        role: Role.Editor,
      });

      // Login as editor
      const loginRes = await app.post("/api/v1/users/login").send({
        email: "editoruser@example.com",
        password: "password123",
      });
      const editorToken = loginRes.body.token;

      // Try to update role as editor
      const updateData = {
        email: "updateme@example.com",
        newRole: Role.Admin,
      };

      const res = await app.patch("/api/v1/users/role").set("Authorization", `Bearer ${editorToken}`).send(updateData);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Forbidden: Admins only");
    });

    test("should return 401 for unauthenticated requests", async () => {
      const updateData = {
        email: "updateme@example.com",
        newRole: Role.Editor,
      };

      const res = await app.patch("/api/v1/users/role").send(updateData);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
