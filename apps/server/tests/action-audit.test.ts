import { SuperTest, Test } from 'supertest';
import { AuditActionType, AuditResourceType, AuditLog } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup.ts';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;
let testUserId: number;

const slackAction = {
	name: 'Audit Slack Action',
	type: 'slack',
	config: { webhookUrl: 'https://hooks.slack.com/services/T000/B000/xyz' },
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
	const testUser = db.prepare('SELECT id FROM users WHERE email = ?').get('provideruser@example.com') as
		| { id: number }
		| undefined;
	if (!testUser) {
		throw new Error('Expected test user provideruser@example.com to exist');
	}
	testUserId = testUser.id;
});

beforeEach(() => {
	db.exec('DELETE FROM audit_logs');
});

afterAll(() => {
	db.close();
});

describe('Action Audit Logs', () => {
	test('should log action creation and retrieve audit log', async () => {
		const createRes = await app
			.post('/api/v1/actions')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(slackAction);

		expect(createRes.status).toBe(201);
		expect(createRes.body.success).toBe(true);

		const auditRes = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
		expect(auditRes.status).toBe(200);
		expect(Array.isArray(auditRes.body.logs)).toBe(true);
		expect(auditRes.body.logs.length).toBe(1);

		const log: AuditLog = auditRes.body.logs[0];
		expect(log.actionType).toBe(AuditActionType.CREATE);
		expect(log.resourceType).toBe(AuditResourceType.ACTION);
		expect(log.resourceId).toBe(String(createRes.body.data.id));
		expect(log.resourceName).toBe(slackAction.name);
		expect(log.userId).toBe(testUserId);
		expect(log.userName).toBe('Provider User');
		expect(log.timestamp).toBeDefined();
	});

	test('should log action create, update and delete audit entries', async () => {
		const createRes = await app
			.post('/api/v1/actions')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send(slackAction);

		expect(createRes.status).toBe(201);
		const resourceId = String(createRes.body.data.id);

		const updateRes = await app
			.put(`/api/v1/actions/${resourceId}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ ...slackAction, name: 'Audit Slack Action Updated' });
		expect(updateRes.status).toBe(200);

		const deleteRes = await app
			.delete(`/api/v1/actions/${resourceId}`)
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(deleteRes.status).toBe(200);

		const auditRes = await app.get('/api/v1/audit?page=1&pageSize=10').set('Authorization', `Bearer ${jwtToken}`);
		expect(auditRes.status).toBe(200);

		const logs = auditRes.body.logs as AuditLog[];
		const actionLogs = logs.filter(
			(log) => log.resourceType === AuditResourceType.ACTION && log.resourceId === resourceId
		);

		expect(actionLogs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ actionType: AuditActionType.CREATE }),
				expect.objectContaining({ actionType: AuditActionType.UPDATE }),
				expect.objectContaining({ actionType: AuditActionType.DELETE }),
			])
		);
		for (const log of actionLogs) {
			expect(log.userId).toBe(testUserId);
			expect(log.userName).toBe('Provider User');
		}
	});
});
