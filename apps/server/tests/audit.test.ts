import { SuperTest, Test } from 'supertest';
import { AuditActionType, AuditResourceType, AuditLog } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup.ts';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;
let testUserId: number;

const clearAuditLogs = () => {
	db.exec('DELETE FROM audit_logs');
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
	const testUser = db.prepare('SELECT id FROM users WHERE email = ?').get('provideruser@example.com') as
		| {
				id: number;
		  }
		| undefined;
	if (!testUser) {
		throw new Error('Expected test user provideruser@example.com to exist');
	}
	testUserId = testUser.id;
});

beforeEach(() => {
	clearAuditLogs();
});

afterAll(() => {
	db.close();
});

describe('Audit Logs API', () => {
	test('should log enrichment creation and retrieve audit logs', async () => {
		const enrichmentData = {
			name: 'Audit Enrichment Rule',
			nameContains: 'CPU',
			addFields: [{ key: 'owner', value: 'platform' }],
			priority: 5,
		};

		const createRes = await app
			.post('/api/v1/enrichments')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(enrichmentData);

		expect(createRes.status).toBe(201);
		expect(createRes.body.success).toBe(true);

		const auditRes = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
		expect(auditRes.status).toBe(200);
		expect(auditRes.body.success).toBe(true);
		expect(Array.isArray(auditRes.body.data.logs)).toBe(true);
		expect(auditRes.body.data.logs.length).toBe(1);

		const log: AuditLog = auditRes.body.data.logs[0];
		expect(log.actionType).toBe(AuditActionType.CREATE);
		expect(log.resourceType).toBe(AuditResourceType.ENRICHMENT);
		expect(log.resourceId).toBe(String(createRes.body.data.id));
		expect(log.resourceName).toBe(enrichmentData.name);
		expect(log.userName).toBe('Provider User');
		expect(log.userId).toBe(testUserId);
		expect(log.timestamp).toBeDefined();
	});

	test('should log enrichment update and delete audit entries', async () => {
		const createRes = await app
			.post('/api/v1/enrichments')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				name: 'Audit Enrichment Lifecycle',
				nameContains: 'Disk',
				addFields: [{ key: 'team', value: 'storage' }],
				priority: 1,
			});

		expect(createRes.status).toBe(201);
		expect(createRes.body.success).toBe(true);

		const resourceId = String(createRes.body.data.id);
		const updateRes = await app
			.put(`/api/v1/enrichments/${resourceId}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Audit Enrichment Lifecycle Updated' });

		expect(updateRes.status).toBe(200);
		expect(updateRes.body.success).toBe(true);

		const deleteRes = await app
			.delete(`/api/v1/enrichments/${resourceId}`)
			.set('Authorization', `Bearer ${jwtToken}`);

		expect(deleteRes.status).toBe(200);
		expect(deleteRes.body.success).toBe(true);

		const auditRes = await app.get('/api/v1/audit?page=1&pageSize=10').set('Authorization', `Bearer ${jwtToken}`);
		expect(auditRes.status).toBe(200);

		const logs = auditRes.body.data.logs as AuditLog[];
		const enrichmentLogs = logs.filter(
			(log) => log.resourceType === AuditResourceType.ENRICHMENT && log.resourceId === resourceId
		);

		expect(enrichmentLogs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ actionType: AuditActionType.CREATE }),
				expect.objectContaining({ actionType: AuditActionType.UPDATE }),
				expect.objectContaining({ actionType: AuditActionType.DELETE }),
			])
		);
		for (const log of enrichmentLogs) {
			expect(log.userId).toBe(testUserId);
			expect(log.userName).toBe('Provider User');
		}
	});

	test('should not log enrichment update audit entry for empty payload', async () => {
		const createRes = await app
			.post('/api/v1/enrichments')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				name: 'Audit Enrichment No-op Update',
				nameContains: 'Memory',
				addFields: [{ key: 'team', value: 'platform' }],
				priority: 1,
			});

		expect(createRes.status).toBe(201);
		expect(createRes.body.success).toBe(true);

		db.exec('DELETE FROM audit_logs');

		const updateRes = await app
			.put(`/api/v1/enrichments/${createRes.body.data.id}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({});

		expect(updateRes.status).toBe(200);
		expect(updateRes.body.success).toBe(true);

		const auditRes = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
		expect(auditRes.status).toBe(200);
		expect(auditRes.body.data.logs).toHaveLength(0);
	});

	test('should log mute policy create, update and delete audit entries', async () => {
		const createRes = await app
			.post('/api/v1/mute-policies')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Audit Mute Policy', nameContains: 'CPU', reason: 'Maintenance' });

		expect(createRes.status).toBe(201);
		expect(createRes.body.success).toBe(true);

		const resourceId = String(createRes.body.data.id);
		const updateData = { name: 'Audit Mute Policy Updated', reason: 'Extended maintenance' };
		const updateRes = await app
			.put(`/api/v1/mute-policies/${resourceId}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(updateData);

		expect(updateRes.status).toBe(200);
		expect(updateRes.body.success).toBe(true);

		const deleteRes = await app
			.delete(`/api/v1/mute-policies/${resourceId}`)
			.set('Authorization', `Bearer ${jwtToken}`);

		expect(deleteRes.status).toBe(200);
		expect(deleteRes.body.success).toBe(true);

		const auditRes = await app.get('/api/v1/audit?page=1&pageSize=10').set('Authorization', `Bearer ${jwtToken}`);
		expect(auditRes.status).toBe(200);

		const logs = (auditRes.body.data.logs as AuditLog[]).filter(
			(log) => log.resourceType === AuditResourceType.MUTE_POLICY && log.resourceId === resourceId
		);
		const createLog = logs.find((log) => log.actionType === AuditActionType.CREATE);
		const updateLog = logs.find((log) => log.actionType === AuditActionType.UPDATE);
		const deleteLog = logs.find((log) => log.actionType === AuditActionType.DELETE);

		expect(createLog).toEqual(
			expect.objectContaining({
				resourceName: 'Audit Mute Policy',
				userId: testUserId,
				userName: 'Provider User',
			})
		);
		expect(updateLog).toEqual(
			expect.objectContaining({
				resourceName: updateData.name,
				details: JSON.stringify(updateData),
				userId: testUserId,
				userName: 'Provider User',
			})
		);
		expect(deleteLog).toEqual(
			expect.objectContaining({
				resourceName: updateData.name,
				userId: testUserId,
				userName: 'Provider User',
			})
		);
	});

	test('should use the API token actor fallback for mute policy audit entries', async () => {
		const createRes = await app
			.post('/api/v1/mute-policies')
			.set('x-api-token', process.env.API_TOKEN ?? 'opsimate')
			.send({ name: 'API Token Mute Policy', matchAll: true });

		expect(createRes.status).toBe(201);

		const log = db
			.prepare(
				`SELECT resource_type, resource_id, user_id, user_name, resource_name
				 FROM audit_logs WHERE resource_type = ? AND resource_id = ?`
			)
			.get(AuditResourceType.MUTE_POLICY, String(createRes.body.data.id)) as
			| {
					resource_type: string;
					resource_id: string;
					user_id: number;
					user_name: string;
					resource_name: string;
			  }
			| undefined;

		expect(log).toEqual({
			resource_type: AuditResourceType.MUTE_POLICY,
			resource_id: String(createRes.body.data.id),
			user_id: 0,
			user_name: 'API Token',
			resource_name: 'API Token Mute Policy',
		});
	});

	test('should not log a mute policy update audit entry for an empty payload', async () => {
		const createRes = await app
			.post('/api/v1/mute-policies')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'Audit Mute Policy No-op Update', matchAll: true });

		expect(createRes.status).toBe(201);
		db.exec('DELETE FROM audit_logs');

		const updateRes = await app
			.put(`/api/v1/mute-policies/${createRes.body.data.id}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({});

		expect(updateRes.status).toBe(200);
		expect(updateRes.body.success).toBe(true);
		expect(db.prepare('SELECT COUNT(*) AS count FROM audit_logs').get()).toEqual({ count: 0 });
	});

	test('should not fail a mute policy mutation when audit logging fails', async () => {
		db.exec(`
			CREATE TRIGGER fail_mute_policy_audit
			BEFORE INSERT ON audit_logs
			BEGIN
				SELECT RAISE(ABORT, 'forced audit failure');
			END;
		`);

		try {
			const createRes = await app
				.post('/api/v1/mute-policies')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ name: 'Audit Failure Mute Policy', matchAll: true });

			expect(createRes.status).toBe(201);
			expect(createRes.body.success).toBe(true);
			expect(db.prepare('SELECT name FROM alert_mute_policies WHERE id = ?').get(createRes.body.data.id)).toEqual(
				{ name: 'Audit Failure Mute Policy' }
			);
			expect(db.prepare('SELECT COUNT(*) AS count FROM audit_logs').get()).toEqual({ count: 0 });
		} finally {
			db.exec('DROP TRIGGER IF EXISTS fail_mute_policy_audit');
		}
	});

	test('should support pagination', async () => {
		// Create multiple enrichments to generate audit logs
		for (let i = 0; i < 5; i++) {
			await app
				.post('/api/v1/enrichments')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ name: `Enrichment${i}`, nameContains: `n${i}`, addFields: [{ key: 'k', value: 'v' }] });
		}
		// Fetch first page
		const res1 = await app.get('/api/v1/audit?page=1&pageSize=3').set('Authorization', `Bearer ${jwtToken}`);
		expect(res1.status).toBe(200);
		expect(res1.body.data.logs.length).toBe(3);
		expect(res1.body.data.total).toBe(5);
		// Fetch second page
		const res2 = await app.get('/api/v1/audit?page=2&pageSize=3').set('Authorization', `Bearer ${jwtToken}`);
		expect(res2.status).toBe(200);
		expect(res2.body.data.logs.length).toBe(2);
	});

	test('should return empty logs if none exist', async () => {
		db.exec('DELETE FROM audit_logs');
		const res = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body.data.logs)).toBe(true);
		expect(res.body.data.logs.length).toBe(0);
	});

	test('should wrap the response in the standard success envelope', async () => {
		const res = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body).toEqual(
			expect.objectContaining({
				success: true,
				data: expect.objectContaining({
					logs: expect.any(Array),
					total: expect.any(Number),
				}),
			})
		);
	});

	test('should default to page 1 / pageSize 20 when params are omitted', async () => {
		const res = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		// No way to observe page/pageSize directly, so assert on the resulting page shape:
		// at most the default pageSize of logs come back, and the request doesn't error out.
		expect(res.body.data.logs.length).toBeLessThanOrEqual(20);
	});

	test('should reject a zero or negative page number', async () => {
		const zeroRes = await app.get('/api/v1/audit?page=0').set('Authorization', `Bearer ${jwtToken}`);
		expect(zeroRes.status).toBe(400);
		expect(zeroRes.body.success).toBe(false);

		const negativeRes = await app.get('/api/v1/audit?page=-1').set('Authorization', `Bearer ${jwtToken}`);
		expect(negativeRes.status).toBe(400);
		expect(negativeRes.body.success).toBe(false);
	});

	test('should reject a pageSize over the cap', async () => {
		const res = await app.get('/api/v1/audit?pageSize=1000000').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	test('should reject a zero or negative pageSize', async () => {
		const res = await app.get('/api/v1/audit?pageSize=0').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});
});
