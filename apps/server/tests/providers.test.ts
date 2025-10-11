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
