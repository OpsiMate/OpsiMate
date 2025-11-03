import { SuperTest, Test } from 'supertest';
import { AuditActionType, AuditResourceType, AuditLog } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup.ts';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const seedProviders = () => {
	db.exec('DELETE FROM audit_logs');
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

beforeEach(() => {
	seedProviders();
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
			password: 'auditpassword',
			SSHPort: 22,
			providerType: 'VM',
		};
		const createRes = await app
			.post('/api/v1/providers')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(providerData);
		expect(createRes.status).toBe(201);
		expect(createRes.body.success).toBe(true);

		// Fetch audit logs
		const auditRes = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
		expect(auditRes.status).toBe(200);
		expect(Array.isArray(auditRes.body.logs)).toBe(true);
		expect(auditRes.body.logs.length).toBe(1);
		const log: AuditLog = auditRes.body.logs[0];
		expect(log.actionType).toBe(AuditActionType.CREATE);
		expect(log.resourceType).toBe(AuditResourceType.PROVIDER);
		expect(log.userId).toBeDefined();
		expect(log.resourceId).toBeDefined();
		expect(log.timestamp).toBeDefined();
		expect(log.userName).toBeDefined();
		expect(log.resourceName).toBeDefined();
	});

	test('should support pagination', async () => {
		// Create multiple providers to generate audit logs
		for (let i = 0; i < 5; i++) {
			await app
				.post('/api/v1/providers')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({
					name: `Provider${i}`,
					providerIP: `10.0.0.${i}`,
					username: 'audituser',
					password: 'auditpassword',
					SSHPort: 22,
					providerType: 'VM',
				});
		}
		// Fetch first page
		const res1 = await app.get('/api/v1/audit?page=1&pageSize=3').set('Authorization', `Bearer ${jwtToken}`);
		expect(res1.status).toBe(200);
		expect(res1.body.logs.length).toBe(3);
		expect(res1.body.total).toBe(5);
		// Fetch second page
		const res2 = await app.get('/api/v1/audit?page=2&pageSize=3').set('Authorization', `Bearer ${jwtToken}`);
		expect(res2.status).toBe(200);
		expect(res2.body.logs.length).toBe(2);
	});

	test('should return empty logs if none exist', async () => {
		db.exec('DELETE FROM audit_logs');
		const res = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body.logs)).toBe(true);
		expect(res.body.logs.length).toBe(0);
	});
});
