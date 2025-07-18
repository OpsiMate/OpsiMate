import request, { SuperTest, Test } from 'supertest';
import { Logger, AuditActionType, AuditResourceType, AuditLog } from '@service-peek/shared';
import Database from 'better-sqlite3';
import { createApp } from '../src/app';

const logger = new Logger('test-audit');

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const seedProviders = () => {
  db.exec('DELETE FROM providers');
  db.prepare(`
    INSERT INTO providers (id, provider_name, provider_ip, username, private_key_filename, ssh_port, created_at, provider_type)
    VALUES (1, 'Test Provider', '127.0.0.1', 'user', 'key.pem', 22, CURRENT_TIMESTAMP, 'VM')
  `).run();
};

beforeAll(async () => {
  db = new Database(':memory:');

  // Create the providers and audit_logs tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_name TEXT NOT NULL,
      provider_ip TEXT DEFAULT NULL,
      username TEXT DEFAULT NULL,
      private_key_filename TEXT NOT NULL,
      ssh_port INTEGER DEFAULT 22,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      provider_type TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      details TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const expressApp = await createApp(db);
  app = request(expressApp) as unknown as SuperTest<Test>;

  // Register and login a user to get a JWT token
  await app.post('/api/v1/users/register').send({
    email: 'audituser@example.com',
    fullName: 'Audit User',
    password: 'testpassword'
  });
  const loginRes = await app.post('/api/v1/users/login').send({
    email: 'audituser@example.com',
    password: 'testpassword'
  });
  jwtToken = loginRes.body.token;
});

beforeEach(() => {
  seedProviders();
  db.exec('DELETE FROM audit_logs');
});

afterAll(() => {
  db.close();
});

describe('Audit Logs API', () => {
  test('should log provider creation and retrieve audit logs', async () => {
    // Create a provider
    const providerData = {
      name: 'Audit Provider',
      providerIP: '192.168.1.1',
      username: 'audituser',
      privateKeyFilename: 'audit.pem',
      SSHPort: 22,
      providerType: 'VM',
    };
    const createRes = await app.post('/api/v1/providers').set('Authorization', `Bearer ${jwtToken}`).send(providerData);
    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);

    // Fetch audit logs
    const auditRes = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
    expect(auditRes.status).toBe(200);
    expect(Array.isArray(auditRes.body.logs)).toBe(true);
    expect(auditRes.body.logs.length).toBeGreaterThan(0);
    const log: AuditLog = auditRes.body.logs[0];
    expect(log.actionType).toBe(AuditActionType.CREATE);
    expect(log.resourceType).toBe(AuditResourceType.PROVIDER);
    expect(log.userId).toBeDefined();
    expect(log.resourceId).toBeDefined();
    expect(log.timestamp).toBeDefined();
  });

  test('should support pagination', async () => {
    // Create multiple providers to generate audit logs
    for (let i = 0; i < 5; i++) {
      await app.post('/api/v1/providers').set('Authorization', `Bearer ${jwtToken}`).send({
        name: `Provider${i}`,
        providerIP: `10.0.0.${i}`,
        username: 'audituser',
        privateKeyFilename: 'audit.pem',
        SSHPort: 22,
        providerType: 'VM',
      });
    }
    // Fetch first page
    const res1 = await app.get('/api/v1/audit?page=1&pageSize=3').set('Authorization', `Bearer ${jwtToken}`);
    expect(res1.status).toBe(200);
    expect(res1.body.logs.length).toBe(3);
    expect(res1.body.total).toBeGreaterThanOrEqual(5);
    // Fetch second page
    const res2 = await app.get('/api/v1/audit?page=2&pageSize=3').set('Authorization', `Bearer ${jwtToken}`);
    expect(res2.status).toBe(200);
    expect(res2.body.logs.length).toBeGreaterThan(0);
  });

  test('should return empty logs if none exist', async () => {
    db.exec('DELETE FROM audit_logs');
    const res = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs.length).toBe(0);
  });
}); 