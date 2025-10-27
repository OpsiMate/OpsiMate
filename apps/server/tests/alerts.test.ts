import request, { SuperTest, Test } from 'supertest';
import { Logger, Alert } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { createApp } from '../src/app';
import { AlertRow } from '../src/dal/models';

const logger = new Logger('test-alerts');

let app: SuperTest<Test>;
let db: Database.Database;
let testAlerts: Alert[] = [];
let jwtToken: string;

const seedAlerts = () => {
	// Clear existing alerts
	db.exec('DELETE FROM alerts');

	// Create sample alerts for testing
	const sampleAlerts: Omit<AlertRow, 'created_at'>[] = [
		{
			id: 'alert-1',
			status: 'active',
			tag: 'system',
			starts_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			alert_url: 'https://example.com/alert/1',
			alert_name: 'Test Alert 1',
			summary: 'Summary 1',
			runbook_url: 'https://runbook.com/1',
			is_dismissed: false,
		},
		{
			id: 'alert-2',
			status: 'warning',
			tag: 'security',
			starts_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
			updated_at: new Date().toISOString(),
			alert_url: 'https://example.com/alert/2',
			alert_name: 'Test Alert 2',
			summary: 'Summary 2',
			runbook_url: 'https://runbook.com/2',
			is_dismissed: false,
		},
		{
			id: 'alert-3',
			status: 'critical',
			tag: 'database',
			starts_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
			updated_at: new Date().toISOString(),
			alert_url: 'https://example.com/alert/3',
			alert_name: 'Test Alert 3',
			summary: 'Summary 3',
			runbook_url: 'https://runbook.com/3',
			is_dismissed: true,
		},
	];

	const insertStmt = db.prepare(`
    INSERT INTO alerts (id, status, tag, starts_at, updated_at, alert_url, alert_name, summary, runbook_url, is_dismissed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

	sampleAlerts.forEach((alert) => {
		insertStmt.run(
			alert.id,
			alert.status,
			alert.tag,
			alert.starts_at,
			alert.updated_at,
			alert.alert_url,
			alert.alert_name,
			alert.summary,
			alert.runbook_url,
			alert.is_dismissed ? 1 : 0
		);
	});

	testAlerts = sampleAlerts.map((row: Omit<AlertRow, 'created_at'>): Alert => {
		return {
			id: row.id,
			status: row.status,
			tag: row.tag,
			startsAt: row.starts_at,
			updatedAt: row.updated_at,
			alertUrl: row.alert_url,
			alertName: row.alert_name,
			createdAt: Date.now().toString(),
			isDismissed: row.is_dismissed,
		};
	}) as Alert[];

	logger.info(`Seeded ${sampleAlerts.length} test alerts`);
};

beforeAll(async () => {
	db = new Database(':memory:');

	// Create the alerts table
	db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      status TEXT,
      tag TEXT,
      starts_at TEXT,
      updated_at TEXT,
      alert_url TEXT,
      alert_name TEXT,
      summary TEXT,
      runbook_url TEXT,
      is_dismissed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

	const expressApp = await createApp(db);
	app = request(expressApp) as unknown as SuperTest<Test>;

	// Register and login a user to get a JWT token
	await app.post('/api/v1/users/register').send({
		email: 'testadmin@example.com',
		fullName: 'Test Admin',
		password: 'testpassword',
	});
	const loginRes = await app.post('/api/v1/users/login').send({
		email: 'testadmin@example.com',
		password: 'testpassword',
	});
	jwtToken = loginRes.body.token;
});

beforeEach(() => {
	seedAlerts();
});

afterAll(() => {
	db.close();
});

describe('Alerts API', () => {
	describe('GET /api/v1/alerts', () => {
		test('should fetch all alerts successfully', async () => {
			const response = await app.get('/api/v1/alerts').set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(Array.isArray(response.body.data?.alerts)).toBe(true);
			expect(response.body.data.alerts).toHaveLength(3);
		});

		test('should return correct alert structure', async () => {
			const response = await app.get('/api/v1/alerts').set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(200);
			const alerts = response.body.data?.alerts;

			expect(alerts[0]).toHaveProperty('id');
			expect(alerts[0]).toHaveProperty('status');
			expect(alerts[0]).toHaveProperty('tag');
			expect(alerts[0]).toHaveProperty('startsAt');
			expect(alerts[0]).toHaveProperty('updatedAt');
			expect(alerts[0]).toHaveProperty('alertUrl');
			expect(alerts[0]).toHaveProperty('alertName');
			expect(alerts[0]).toHaveProperty('isDismissed');
			expect(alerts[0]).toHaveProperty('summary');
			expect(alerts[0]).toHaveProperty('runbookUrl');
		});

		test('should return empty array when no alerts exist', async () => {
			// Clear all alerts
			db.exec('DELETE FROM alerts');

			const response = await app.get('/api/v1/alerts').set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data?.alerts).toHaveLength(0);
		});
	});

	describe('PATCH /api/v1/alerts/:id/dismiss', () => {
		test('should dismiss an active alert successfully', async () => {
			const alertId = testAlerts[0].id; // 'alert-1'

			const response = await app
				.patch(`/api/v1/alerts/${alertId}/dismiss`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data?.alert.isDismissed).toBe(true);
			expect(response.body.data?.alert.id).toBe(alertId);
		});

		test('should update the database when dismissing an alert', async () => {
			const alertId = testAlerts[0].id; // 'alert-1'

			// Verify initial state
			const beforeStmt = db.prepare('SELECT is_dismissed FROM alerts WHERE id = ?');
			const beforeResult = beforeStmt.get(alertId) as { is_dismissed: number };
			expect(beforeResult.is_dismissed).toBe(0);

			// Dismiss the alert
			await app.patch(`/api/v1/alerts/${alertId}/dismiss`).set('Authorization', `Bearer ${jwtToken}`);

			// Verify updated state
			const afterStmt = db.prepare('SELECT is_dismissed FROM alerts WHERE id = ?');
			const afterResult = afterStmt.get(alertId) as { is_dismissed: number };
			expect(afterResult.is_dismissed).toBe(1);
		});

		test('should handle dismissing an already dismissed alert', async () => {
			const alertId = testAlerts[2].id; // 'alert-3' (already dismissed)

			const response = await app
				.patch(`/api/v1/alerts/${alertId}/dismiss`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data?.alert.isDismissed).toBe(true);
		});

		test('should return 404 for non-existent alert', async () => {
			const response = await app
				.patch('/api/v1/alerts/nonexistent-id-123/dismiss')
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(404);
			expect(response.body.success).toBe(false);
		});
	});

	describe('PATCH /api/v1/alerts/:id/undismiss', () => {
		test('should undismiss a dismissed alert successfully', async () => {
			const alertId = testAlerts[2].id; // 'alert-3' (already dismissed)

			const response = await app
				.patch(`/api/v1/alerts/${alertId}/undismiss`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data?.alert.isDismissed).toBe(false);
			expect(response.body.data?.alert.id).toBe(alertId);
		});

		test('should update the database when undismissing an alert', async () => {
			const alertId = testAlerts[2].id; // 'alert-3' (already dismissed)

			// Verify initial state
			const beforeStmt = db.prepare('SELECT is_dismissed FROM alerts WHERE id = ?');
			const beforeResult = beforeStmt.get(alertId) as { is_dismissed: number };
			expect(beforeResult.is_dismissed).toBe(1);

			// Undismiss the alert
			await app.patch(`/api/v1/alerts/${alertId}/undismiss`).set('Authorization', `Bearer ${jwtToken}`);

			// Verify updated state
			const afterStmt = db.prepare('SELECT is_dismissed FROM alerts WHERE id = ?');
			const afterResult = afterStmt.get(alertId) as { is_dismissed: number };
			expect(afterResult.is_dismissed).toBe(0);
		});

		test('should handle undismissing an already active alert', async () => {
			const alertId = testAlerts[0].id; // 'alert-1' (not dismissed)

			const response = await app
				.patch(`/api/v1/alerts/${alertId}/undismiss`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data?.alert.isDismissed).toBe(false);
		});

		test('should return 404 for non-existent alert', async () => {
			const response = await app
				.patch('/api/v1/alerts/nonexistent-id-123/undismiss')
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(404);
			expect(response.body.success).toBe(false);
		});

		test('should handle dismiss and undismiss cycle correctly', async () => {
			const alertId = testAlerts[0].id; // 'alert-1'

			// First dismiss the alert
			const dismissResponse = await app
				.patch(`/api/v1/alerts/${alertId}/dismiss`)
				.set('Authorization', `Bearer ${jwtToken}`);
			expect(dismissResponse.status).toBe(200);
			expect(dismissResponse.body.data?.alert.isDismissed).toBe(true);

			// Then undismiss the alert
			const undismissResponse = await app
				.patch(`/api/v1/alerts/${alertId}/undismiss`)
				.set('Authorization', `Bearer ${jwtToken}`);
			expect(undismissResponse.status).toBe(200);
			expect(undismissResponse.body.data?.alert.isDismissed).toBe(false);

			// Verify final state in database
			const finalStmt = db.prepare('SELECT is_dismissed FROM alerts WHERE id = ?');
			const finalResult = finalStmt.get(alertId) as { is_dismissed: number };
			expect(finalResult.is_dismissed).toBe(0);
		});
	});

	describe('Edge cases and error handling', () => {
		test('should handle malformed requests gracefully', async () => {
			const response = await app
				.get('/api/v1/alerts/invalid-endpoint')
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(404);
		});

		test('should handle database errors gracefully', async () => {
			// Close the database to simulate an error
			db.close();

			const response = await app.get('/api/v1/alerts').set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBeGreaterThanOrEqual(500);

			// Recreate database for cleanup
			db = new Database(':memory:');
			db.exec(`
        CREATE TABLE IF NOT EXISTS alerts (
          id TEXT PRIMARY KEY,
          status TEXT,
          tag TEXT,
          starts_at TEXT,
          updated_at TEXT,
          alert_url TEXT,
          alert_name TEXT,
          summary TEXT,
          runbook_url TEXT,
          is_dismissed BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
		});
	});
});
