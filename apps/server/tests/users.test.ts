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
    // Delete all users except the admin
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
      const users = db.prepare("SELECT * FROM users WHERE email = ?").get("newuser@example.com") as any;
      expect(users).toBeDefined();
      expect(users.full_name).toBe("New User");
      expect(users.role).toBe(Role.Editor);
    });

    test("should return 403 for non-admin users", async () => {
      // Create an editor user
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
});
