import { SuperTest, Test } from 'supertest';
import { AuditActionType, AuditResourceType } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const seedAuditLogs = () => {
	db.exec('DELETE FROM audit_logs');

	const sampleLogs = [
		{
			action_type: AuditActionType.CREATE,
			resource_type: AuditResourceType.PROVIDER,
			resource_id: '1',
			user_id: 1,
			user_name: 'Elshad',
			resource_name: 'my server',
			timestamp: '2024-11-10 14:20:30',
			details: null,
		},
		{
			action_type: AuditActionType.UPDATE,
			resource_type: AuditResourceType.SERVICE,
			resource_id: '2',
			user_id: 2,
			user_name: 'Farhad',
			resource_name: 'api-service',
			timestamp: '2024-12-15 09:45:12',
			details: 'Updated service',
		},
		{
			action_type: AuditActionType.DELETE,
			resource_type: AuditResourceType.USER,
			resource_id: '3',
			user_id: 1,
			user_name: 'Elshad',
			resource_name: 'admin',
			timestamp: '2025-01-20 16:30:45',
			details: null,
		},
		{
			action_type: AuditActionType.CREATE,
			resource_type: AuditResourceType.SERVICE,
			resource_id: '4',
			user_id: 3,
			user_name: 'Alan',
			resource_name: 'web Service',
			timestamp: '2025-03-05 11:15:20',
			details: null,
		},
		{
			action_type: AuditActionType.UPDATE,
			resource_type: AuditResourceType.PROVIDER,
			resource_id: '5',
			user_id: 2,
			user_name: 'Farhad',
			resource_name: 'dev Server',
			timestamp: '2025-05-12 08:50:35',
			details: null,
		},
		{
			action_type: AuditActionType.DELETE,
			resource_type: AuditResourceType.SERVICE,
			resource_id: '6',
			user_id: 4,
			user_name: 'Bob',
			resource_name: 'web Service',
			timestamp: '2025-07-18 13:25:10',
			details: null,
		},
		{
			action_type: AuditActionType.CREATE,
			resource_type: AuditResourceType.VIEW,
			resource_id: '7',
			user_id: 3,
			user_name: 'Alan',
			resource_name: 'dashboardView',
			timestamp: '2025-08-22 10:10:55',
			details: null,
		},
		{
			action_type: AuditActionType.UPDATE,
			resource_type: AuditResourceType.SECRET,
			resource_id: '8',
			user_id: 5,
			user_name: 'Smith',
			resource_name: 'ssh-key',
			timestamp: '2025-09-28 15:35:20',
			details: null,
		},
	];

	const insertStmt = db.prepare(`
    INSERT INTO audit_logs (action_type, resource_type, resource_id, user_id, user_name, resource_name, timestamp, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

	sampleLogs.forEach((log) => {
		insertStmt.run(
			log.action_type,
			log.resource_type,
			log.resource_id,
			log.user_id,
			log.user_name,
			log.resource_name,
			log.timestamp,
			log.details
		);
	});
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

beforeEach(() => {
	seedAuditLogs();
});

afterAll(() => {
	db.close();
});

describe('Audit Log Filters', () => {
	test('should handle all filter combinations', async () => {
		// No filters - return all
		let res = await app.get('/api/v1/audit').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.total).toBeDefined();
		expect(res.body.logs.length).toBe(8);
		expect(res.body.total).toBe(8);

		// Filter by userName
		res = await app.get('/api/v1/audit?userName=Elshad').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(2);

		res = await app.get('/api/v1/audit?userName=Alan').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(2);

		// Filter by resourceName
		res = await app.get('/api/v1/audit?resourceName=web Service').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(2);

		// OR logic: userName OR resourceName (both conditions checked separately)
		res = await app
			.get('/api/v1/audit?userName=Farhad&resourceName=web Service')
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(4); // Farhad (2) OR web Service (2) = 4

		// Filter by actionType
		res = await app.get('/api/v1/audit?actionType=CREATE').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(3);

		res = await app.get('/api/v1/audit?actionType=UPDATE').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(3);

		res = await app.get('/api/v1/audit?actionType=DELETE').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(2);

		// Filter by resourceType
		res = await app.get('/api/v1/audit?resourceType=PROVIDER').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(2);

		res = await app.get('/api/v1/audit?resourceType=SERVICE').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(3);

		res = await app.get('/api/v1/audit?resourceType=USER').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(1);

		res = await app.get('/api/v1/audit?resourceType=VIEW').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(1);

		res = await app.get('/api/v1/audit?resourceType=SECRET').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(1);

		// Time range filtering
		res = await app
			.get('/api/v1/audit?startTime=2025-01-01T00:00:00Z&endTime=2025-05-31T23:59:59Z')
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(3);

		// Combined filters: userName + actionType
		res = await app
			.get('/api/v1/audit?userName=Elshad&actionType=CREATE')
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(1);

		// Combined filters: resourceType + actionType
		res = await app
			.get('/api/v1/audit?resourceType=SERVICE&actionType=UPDATE')
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(1);

		// Pagination
		res = await app.get('/api/v1/audit?page=1&pageSize=3').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.total).toBeDefined();
		expect(res.body.logs.length).toBe(3);
		expect(res.body.total).toBe(8);

		// No matches
		res = await app.get('/api/v1/audit?userName=noMatching').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.logs).toBeDefined();
		expect(res.body.logs.length).toBe(0);
	});

	test('should validate filter parameters', async () => {
		// Invalid startTime
		let res = await app.get('/api/v1/audit?startTime=invalidFormat').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(400);
		expect(res.body.error).toBeDefined();
		expect(res.body.error).toContain('Invalid startTime format');

		// Invalid endTime
		res = await app.get('/api/v1/audit?endTime=notDate').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(400);
		expect(res.body.error).toBeDefined();
		expect(res.body.error).toContain('Invalid endTime format');

		// startTime after endTime
		res = await app
			.get('/api/v1/audit?startTime=2025-10-01T00:00:00Z&endTime=2024-11-01T00:00:00Z')
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(400);
		expect(res.body.error).toBeDefined();
		expect(res.body.error).toBe('startTime must be before endTime');

		// Missing authentication
		res = await app.get('/api/v1/audit');
		expect(res.status).toBe(401);

		// Non-existent route
		res = await app.get('/api/v1/audit/35').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(404);
	});
});
