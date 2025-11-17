import { SuperTest, Test } from 'supertest';
import { Logger, Alert } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { AlertRow } from '../src/dal/models';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

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
			type: 'Grafana',
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
			type: 'Grafana',
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
			type: 'Grafana',
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
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
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
			expect(Array.isArray(response.body.data.alerts)).toBe(true);
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
			expect(testAlerts[0].isDismissed).toBe(false);

			const response = await app
				.patch(`/api/v1/alerts/${alertId}/dismiss`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data?.alert.isDismissed).toBe(true);
			expect(response.body.data?.alert.id).toBe(alertId);
		});

		test('should handle dismissing an already dismissed alert', async () => {
			const alertId = testAlerts[2].id; // 'alert-3' (already dismissed)
			expect(testAlerts[2].isDismissed).toBe(true);

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

		test('should return 401 for request without authentication', async () => {
			const alertId = testAlerts[0].id; // 'alert-1'

			const response = await app.patch(`/api/v1/alerts/${alertId}/dismiss`);
			// No Authorization header set

			expect(response.status).toBe(401);
			expect(response.body.success).toBe(false);
		});
	});

	describe('PATCH /api/v1/alerts/:id/undismiss', () => {
		test('should undismiss a dismissed alert successfully', async () => {
			const alertId = testAlerts[2].id; // 'alert-3' (already dismissed)
			expect(testAlerts[2].isDismissed).toBe(true);

			const response = await app
				.patch(`/api/v1/alerts/${alertId}/undismiss`)
				.set('Authorization', `Bearer ${jwtToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data?.alert.isDismissed).toBe(false);
			expect(response.body.data?.alert.id).toBe(alertId);
		});

		test('should handle undismissing an already active alert', async () => {
			const alertId = testAlerts[0].id; // 'alert-1' (not dismissed)
			expect(testAlerts[0].isDismissed).toBe(false);

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

		test('should return 401 for request without authentication', async () => {
			const alertId = testAlerts[2].id; // 'alert-3'

			const response = await app.patch(`/api/v1/alerts/${alertId}/undismiss`);
			// No Authorization header set

			expect(response.status).toBe(401);
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

	describe('POST /api/v1/alerts/custom', () => {
		test('should create a new alert successfully with valid payload', async () => {
			const payload = {
				id: 'new-alert-1',
				status: 'active',
				tag: 'testing',
				startsAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				alertUrl: 'https://example.com/new',
				alertName: 'Custom Alert Test',
				summary: 'Something happened',
				runbookUrl: 'https://runbook.com/test',
				createdAt: new Date().toISOString(),
			};

			const response = await app
				.post('/api/v1/alerts/custom')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.alertId).toBe(payload.id);

			const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(payload.id);
			expect(row).toBeDefined();
			expect(row.alert_name).toBe(payload.alertName);
		});

		test('should return 400 for invalid payload (missing required fields)', async () => {
			const payload = {
				// Missing id, startsAt, etc.
				status: 'active',
				tag: 'invalid',
			};

			const response = await app
				.post('/api/v1/alerts/custom')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(400);
			expect(response.body.error).toBeDefined();
		});

		test('should return 400 for invalid URL fields', async () => {
			const payload = {
				id: 'bad-url-alert',
				status: 'active',
				tag: 'bad',
				startsAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				alertUrl: 'not-a-url',
				alertName: 'Bad URL Test',
				createdAt: new Date().toISOString(),
			};

			const response = await app
				.post('/api/v1/alerts/custom')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(400);
			expect(response.body.error).toBeDefined();
		});

		// todo: uncomment when adding permissions validation
		test('should return 401 when no auth token is provided', async () => {
			const payload = {
				id: 'unauthorized-alert',
				status: 'active',
				tag: 'security',
				startsAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				alertUrl: 'https://example.com/a',
				alertName: 'Unauthorized Alert',
				createdAt: new Date().toISOString(),
			};

			const response = await app.post('/api/v1/alerts/custom').send(payload);

			expect(response.status).toBe(401);
			expect(response.body.success).toBe(false);
		});

		test('should handle DB insertion duplicate id - update status', async () => {
			const existingId = testAlerts[0].id;

			const payload = {
				id: existingId, // duplicate primary key
				status: 'resolved',
				tag: 'duplicate-test',
				startsAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				alertUrl: 'https://example.com/dup',
				alertName: 'Duplicate Test',
				createdAt: new Date().toISOString(),
			};

			const response = await app
				.post('/api/v1/alerts/custom')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			// Expect internal server error due to unique constraint
			expect(response.status).toBe(200);

			const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(payload.id);
			expect(row).toBeDefined();
			expect(row.alert_name).toBe(payload.alertName);
			expect(row.status).toBe(payload.status);
		});
	});

	describe('POST /api/v1/alerts/custom/gcp', () => {
		test('should create a new GCP alert successfully with valid payload', async () => {
			const payload = {
				incident: {
					incident_id: 'gcp-alert-1',
					state: 'open',
					resource_name: 'compute-instance',
					started_at: new Date().toISOString(),
					url: 'https://console.cloud.google.com/alerting/incidents/1',
					policy_name: 'High CPU Usage',
					summary: 'CPU > 90%',
					documentation: { content: 'https://runbook.com/cpu' },
				},
			};

			const response = await app
				.post('/api/v1/alerts/custom/gcp')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.alertId).toBe(payload.incident.incident_id);

			const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(payload.incident.incident_id);
			expect(row).toBeDefined();
			expect(row.alert_name).toBe(payload.incident.policy_name);
			expect(row.status).toBe(payload.incident.state);
			expect(row.tag).toBe(payload.incident.resource_name);
		});

		test('should update an existing GCP alert when incident already exists', async () => {
			const existingId = testAlerts[0].id;

			const payload = {
				incident: {
					incident_id: existingId,
					state: 'incident_updated',
					resource_name: 'updated-resource',
					started_at: new Date().toISOString(),
					url: 'https://console.cloud.google.com/alerting/incidents/updated',
					policy_name: 'Updated Policy',
					summary: 'Updated summary',
					documentation: { content: 'https://runbook.com/updated' },
				},
			};

			const response = await app
				.post('/api/v1/alerts/custom/gcp')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);

			const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(existingId);
			expect(row).toBeDefined();
			expect(row.alert_name).toBe(payload.incident.policy_name);
			expect(row.status).toBe(payload.incident.state);
			expect(row.tag).toBe(payload.incident.resource_name);
		});

		test('should delete an alert when GCP incident state is closed', async () => {
			const existingId = testAlerts[0].id;

			const payload = {
				incident: {
					incident_id: existingId,
					state: 'closed',
					resource_name: 'system',
					started_at: new Date().toISOString(),
					url: '',
					policy_name: '',
					summary: '',
				},
			};

			const response = await app
				.post('/api/v1/alerts/custom/gcp')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);

			const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(existingId);
			expect(row).toBeUndefined();
		});

		test('should return 400 for missing incident field', async () => {
			const response = await app
				.post('/api/v1/alerts/custom/gcp')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ notIncident: true });

			expect(response.status).toBe(400);
			expect(response.body.error).toBe('Missing incident in payload');
		});

		test('should return 401 when no auth token is provided', async () => {
			const payload = {
				incident: {
					incident_id: 'unauthorized-gcp-alert',
					state: 'open',
				},
			};

			const response = await app.post('/api/v1/alerts/custom/gcp').send(payload);

			expect(response.status).toBe(401);
			expect(response.body.success).toBe(false);
		});

		test('should create a GCP alert successfully with complex payload', async () => {
			const payload = {
				incident: {
					condition: {
						conditionThreshold: {
							aggregations: [
								{
									alignmentPeriod: '300s',
									perSeriesAligner: 'ALIGN_RATE',
								},
							],
							comparison: 'COMPARISON_GT',
							duration: '0s',
							filter: 'resource.type = "gce_instance" AND metric.type = "compute.googleapis.com/instance/cpu/usage_time"',
							trigger: { count: 1 },
						},
						displayName: 'idans123123',
						name: 'projects/opsimate/alertPolicies/4182657834417840826/conditions/4182657834417841543',
					},
					condition_name: 'idans123123',
					documentation: {
						content: 'its a very cool test',
						mime_type: 'text/markdown',
						subject: '[ALERT - No severity] idans123123 on opsimate opsimate-server',
					},
					ended_at: null,
					incident_id: '0.nzm8u2jxkaq5',
					metadata: {
						system_labels: {},
						user_labels: {},
					},
					metric: {
						displayName: 'CPU usage',
						labels: { instance_name: 'opsimate-server' },
						type: 'compute.googleapis.com/instance/cpu/usage_time',
					},
					observed_value: '0.250',
					policy_name: 'mytestforgcp',
					resource: {
						labels: {
							instance_id: '5882678762632851126',
							project_id: 'opsimate',
							zone: 'us-central1-c',
						},
						type: 'gce_instance',
					},
					resource_display_name: 'opsimate-server',
					resource_id: '',
					resource_name: 'opsimate opsimate-server',
					resource_type_display_name: 'VM Instance',
					scoping_project_id: 'opsimate',
					scoping_project_number: 39358210889,
					severity: 'No severity',
					started_at: 1763324240,
					state: 'open',
					summary:
						'CPU usage for opsimate opsimate-server with metric labels {instance_name=opsimate-server} is above the threshold of 0.000 with a value of 0.250.',
					threshold_value: '0',
					url: 'https://console.cloud.google.com/monitoring/alerting/alerts/0.nzm8u2jxkaq5?channelType=webhook&project=opsimate',
				},
				version: '1.2',
			};

			const response = await app
				.post('/api/v1/alerts/custom/gcp')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.alertId).toBe('0.nzm8u2jxkaq5');

			// Validate DB
			const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get('0.nzm8u2jxkaq5');
			expect(row).toBeDefined();
			expect(row.alert_name).toBe('mytestforgcp');
			expect(row.summary).toContain('CPU usage for opsimate');
			expect(row.tag).toBe('opsimate opsimate-server');
			expect(row.status).toBe('open');

			// ISO 8601 regex: 2025-11-17T18:03:39.352Z
			const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

			expect(typeof row.starts_at).toBe('string');
			expect(row.starts_at).toMatch(isoRegex);

			expect(typeof row.updated_at).toBe('string');
			expect(row.updated_at).toMatch(isoRegex);
		});
	});
});
