import request, { SuperTest, Test } from 'supertest';
import { Logger, AuditActionType, AuditResourceType, AuditLog, IntegrationType } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { createApp } from '../src/app';

const logger = new Logger('test-integration-audit');

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

beforeAll(async () => {
  db = new Database(':memory:');

  // Create the necessary tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      external_url TEXT NOT NULL,
      credentials TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
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
  db.exec('DELETE FROM integrations');
  db.exec('DELETE FROM audit_logs');
});

afterAll(() => {
  db.close();
});

describe('Integration Audit Logs', () => {
  test('should log integration creation and retrieve audit logs', async () => {
    // Create an integration
    const integrationData = {
      name: 'Test Grafana Integration',
      type: IntegrationType.Grafana,
      externalUrl: 'https://grafana.example.com',
      credentials: {
        username: 'admin',
        password: 'password123'
      }
    };
    
    const createRes = await app.post('/api/v1/integrations')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(integrationData);
    
    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);

    // Fetch audit logs
    const auditRes = await app.get('/api/v1/audit')
      .set('Authorization', `Bearer ${jwtToken}`);
    
    expect(auditRes.status).toBe(200);
    expect(Array.isArray(auditRes.body.logs)).toBe(true);
    expect(auditRes.body.logs.length).toBeGreaterThan(0);
    
    const log: AuditLog = auditRes.body.logs[0];
    expect(log.actionType).toBe(AuditActionType.CREATE);
    expect(log.resourceType).toBe(AuditResourceType.INTEGRATION);
    expect(log.userId).toBeDefined();
    expect(log.resourceId).toBeDefined();
    expect(log.timestamp).toBeDefined();
    expect(log.userName).toBeDefined();
    expect(log.resourceName).toBe(integrationData.name);
    expect(log.details).toContain('Integration type: Grafana');
    expect(log.details).toContain(integrationData.externalUrl);
  });

  test('should log integration update', async () => {
    // First create an integration
    const integrationData = {
      name: 'Test Kibana Integration',
      type: IntegrationType.Kibana,
      externalUrl: 'https://kibana.example.com',
      credentials: {
        username: 'admin',
        password: 'password123'
      }
    };
    
    const createRes = await app.post('/api/v1/integrations')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(integrationData);
    
    expect(createRes.status).toBe(201);
    const integrationId = createRes.body.data.id;

    // Update the integration
    const updateData = {
      name: 'Updated Kibana Integration',
      type: IntegrationType.Kibana,
      externalUrl: 'https://updated-kibana.example.com',
      credentials: {
        username: 'admin',
        password: 'newpassword123'
      }
    };
    
    const updateRes = await app.put(`/api/v1/integrations/${integrationId}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(updateData);
    
    expect(updateRes.status).toBe(200);

    // Fetch audit logs
    const auditRes = await app.get('/api/v1/audit')
      .set('Authorization', `Bearer ${jwtToken}`);
    
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.logs.length).toBe(2); // CREATE and UPDATE
    
    // Check the UPDATE log
    const updateLog = auditRes.body.logs.find((log: AuditLog) => log.actionType === AuditActionType.UPDATE);
    expect(updateLog).toBeDefined();
    expect(updateLog.resourceType).toBe(AuditResourceType.INTEGRATION);
    expect(updateLog.resourceName).toBe(updateData.name);
    expect(updateLog.details).toContain('Integration type: Kibana');
    expect(updateLog.details).toContain(updateData.externalUrl);
  });

  test('should log integration deletion', async () => {
    // First create an integration
    const integrationData = {
      name: 'Test Datadog Integration',
      type: IntegrationType.Datadog,
      externalUrl: 'https://datadog.example.com',
      credentials: {
        apiKey: 'test-api-key'
      }
    };
    
    const createRes = await app.post('/api/v1/integrations')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(integrationData);
    
    expect(createRes.status).toBe(201);
    const integrationId = createRes.body.data.id;

    // Delete the integration
    const deleteRes = await app.delete(`/api/v1/integrations/${integrationId}`)
      .set('Authorization', `Bearer ${jwtToken}`);
    
    expect(deleteRes.status).toBe(200);

    // Fetch audit logs
    const auditRes = await app.get('/api/v1/audit')
      .set('Authorization', `Bearer ${jwtToken}`);
    
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.logs.length).toBe(2); // CREATE and DELETE
    
    // Check the DELETE log
    const deleteLog = auditRes.body.logs.find((log: AuditLog) => log.actionType === AuditActionType.DELETE);
    expect(deleteLog).toBeDefined();
    expect(deleteLog.resourceType).toBe(AuditResourceType.INTEGRATION);
    expect(deleteLog.resourceName).toBe(integrationData.name);
    expect(deleteLog.details).toContain('Integration type: Datadog');
    expect(deleteLog.details).toContain(integrationData.externalUrl);
  });

  test('should support pagination for integration audit logs', async () => {
    // Create multiple integrations to generate audit logs
    for (let i = 0; i < 5; i++) {
      await app.post('/api/v1/integrations')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          name: `Integration${i}`,
          type: IntegrationType.Grafana,
          externalUrl: `https://grafana${i}.example.com`,
          credentials: { username: 'admin', password: 'password' }
        });
    }
    
    // Fetch first page
    const res1 = await app.get('/api/v1/audit?page=1&pageSize=3')
      .set('Authorization', `Bearer ${jwtToken}`);
    
    expect(res1.status).toBe(200);
    expect(res1.body.logs.length).toBe(3);
    expect(res1.body.total).toBeGreaterThanOrEqual(5);
    
    // Fetch second page
    const res2 = await app.get('/api/v1/audit?page=2&pageSize=3')
      .set('Authorization', `Bearer ${jwtToken}`);
    
    expect(res2.status).toBe(200);
    expect(res2.body.logs.length).toBeGreaterThan(0);
  });

  test('should return empty logs if no integrations exist', async () => {
    db.exec('DELETE FROM audit_logs');
    const res = await app.get('/api/v1/audit')
      .set('Authorization', `Bearer ${jwtToken}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs.length).toBe(0);
  });
});
