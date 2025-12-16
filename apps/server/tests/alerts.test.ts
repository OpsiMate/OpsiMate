import { SuperTest, Test } from 'supertest';
import { Alert, AlertStatus, Logger } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { AlertRow } from '../src/dal/models';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

const logger = new Logger('test-alerts');

let app: SuperTest<Test>;
let db: Database.Database;
let testAlerts: Alert[] = [];
let testAlertsArchived: Alert[] = [];
let jwtToken: string;

const seedAlerts = () => {
	// Clear existing alerts
	db.exec('DELETE FROM alerts');
	db.exec('DELETE FROM alerts_archived');

	// Create sample active alerts
	const sampleAlerts: Omit<AlertRow, 'created_at'>[] = [
		{
			id: 'alert-1',
			type: 'Grafana',
			status: 'active',
			tags: JSON.stringify({ tag: 'system' }),
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
			tags: JSON.stringify({ tag: 'security' }),
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
			tags: JSON.stringify({ tag: 'database' }),
			starts_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
			updated_at: new Date().toISOString(),
			alert_url: 'https://example.com/alert/3',
			alert_name: 'Test Alert 3',
			summary: 'Summary 3',
			runbook_url: 'https://runbook.com/3',
			is_dismissed: true,
		},
	];

	// Insert active alerts
	const insertStmt = db.prepare(`
        INSERT INTO alerts (id, status, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url,
                            is_dismissed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

	sampleAlerts.forEach((alert) => {
		insertStmt.run(
			alert.id,
			alert.status,
			alert.tags,
			alert.starts_at,
			alert.updated_at,
			alert.alert_url,
			alert.alert_name,
			alert.summary,
			alert.runbook_url,
			alert.is_dismissed ? 1 : 0
		);
	});

	// -------------------------
	// Add sample archived alert
	// -------------------------

	const sampleArchivedAlerts = [
		{
			id: 'archived-1',
			type: 'Grafana',
			status: 'resolved',
			tags: { tag: 'system' },
			starts_at: new Date(Date.now() - 5 * 3600000).toISOString(), // 5 hours ago
			updated_at: new Date().toISOString(),
			alert_url: 'https://example.com/archived/1',
			alert_name: 'Archived Test Alert',
			summary: 'Archived Summary',
			runbook_url: 'https://runbook.com/archived1',
			archived_at: new Date().toISOString(),
			is_dismissed: false,
		},
	];

	const insertArchivedStmt = db.prepare(`
        INSERT INTO alerts_archived
        (id, status, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url, archived_at,
         is_dismissed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

	sampleArchivedAlerts.forEach((alert) => {
		insertArchivedStmt.run(
			alert.id,
			alert.status,
			JSON.stringify(alert.tags ?? {}),
			alert.starts_at,
			alert.updated_at,
			alert.alert_url,
			alert.alert_name,
			alert.summary,
			alert.runbook_url,
			alert.archived_at,
			alert.is_dismissed ? 1 : 0
		);
	});

	// Convert active alerts to exported testAlerts
	testAlerts = sampleAlerts.map((row) => ({
		id: row.id,
		status: row.status == 'firing' ? AlertStatus.FIRING : AlertStatus.RESOLVED,
		type: row.type,
		tags: row.tags,
		startsAt: row.starts_at,
		updatedAt: row.updated_at,
		alertUrl: row.alert_url,
		alertName: row.alert_name,
		createdAt: Date.now().toString(),
		isDismissed: row.is_dismissed,
	}));

	// Optionally export archived alerts to tests
	testAlertsArchived = sampleArchivedAlerts.map((row) => ({
		id: row.id,
		status: row.status == 'firing' ? AlertStatus.FIRING : AlertStatus.RESOLVED,
		type: row.type,
		tags: row.tags,
		startsAt: row.starts_at,
		updatedAt: row.updated_at,
		alertUrl: row.alert_url,
		alertName: row.alert_name,
		archivedAt: row.archived_at,
		isDismissed: row.is_dismissed,
	}));

	logger.info(`Seeded ${sampleAlerts.length} active alerts + ${sampleArchivedAlerts.length} archived alerts`);
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
			expect(alerts[0]).toHaveProperty('tags');
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

	describe('PATCH /api/v1/alerts/:id/owner', () => {
		test('should set owner for an alert successfully', async () => {
			const alertId = testAlerts[0].id; // 'alert-1'
			// User ID 1 is the test user created in setupUserWithToken
			const ownerId = 1;

			const response = await app
				.patch(`/api/v1/alerts/${alertId}/owner`)
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ ownerId });

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data?.alert.ownerId).toBe(ownerId);
			expect(response.body.data?.alert.id).toBe(alertId);
		});

		test('should change owner for an alert successfully', async () => {
			const alertId = testAlerts[0].id; // 'alert-1'

			// First set owner to 1
			await app
				.patch(`/api/v1/alerts/${alertId}/owner`)
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ ownerId: 1 });

			// Then change owner to a different user (we'll use the same ID since we only have one test user)
			const response = await app
				.patch(`/api/v1/alerts/${alertId}/owner`)
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ ownerId: 1 });

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data?.alert.ownerId).toBe(1);
		});

		test('should clear owner for an alert (set to null)', async () => {
			const alertId = testAlerts[0].id; // 'alert-1'

			// First set an owner
			await app
				.patch(`/api/v1/alerts/${alertId}/owner`)
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ ownerId: 1 });

			// Then clear the owner
			const response = await app
				.patch(`/api/v1/alerts/${alertId}/owner`)
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ ownerId: null });

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data?.alert.ownerId).toBeNull();
		});

		test('should return 404 for non-existent alert', async () => {
			const response = await app
				.patch('/api/v1/alerts/nonexistent-id-123/owner')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ ownerId: 1 });

			expect(response.status).toBe(404);
			expect(response.body.success).toBe(false);
		});

		test('should return 400 for invalid ownerId (string)', async () => {
			const alertId = testAlerts[0].id;

			const response = await app
				.patch(`/api/v1/alerts/${alertId}/owner`)
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ ownerId: 'invalid' });

			expect(response.status).toBe(400);
			expect(response.body.success).toBe(false);
			expect(response.body.error).toBe('Validation error');
		});

		test('should return 400 for invalid ownerId (negative number)', async () => {
			const alertId = testAlerts[0].id;

			const response = await app
				.patch(`/api/v1/alerts/${alertId}/owner`)
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ ownerId: -1 });

			expect(response.status).toBe(400);
			expect(response.body.success).toBe(false);
			expect(response.body.error).toBe('Validation error');
		});

		test('should return 401 for request without authentication', async () => {
			const alertId = testAlerts[0].id;

			const response = await app.patch(`/api/v1/alerts/${alertId}/owner`).send({ ownerId: 1 });

			expect(response.status).toBe(401);
			expect(response.body.success).toBe(false);
		});
	});

	describe('POST /api/v1/alerts/custom', () => {
		test('should create a new alert successfully with valid payload', async () => {
			const payload = {
				id: 'new-alert-1',
				status: 'active',
				tags: { tag: 'testing' },
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
				tags: { tag: 'bad' },
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

		test('should return 401 when no auth token is provided', async () => {
			const payload = {
				id: 'unauthorized-alert',
				status: 'active',
				tags: { tag: 'security' },
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
	});

	describe('POST /api/v1/alerts/custom/datadog', () => {
		test('should create a new Datadog alert successfully with valid payload', async () => {
			const alertId = 'alert-id';
			const alertInstanceId = 'alert-id-instance';

			const payload = {
				alert_id: alertId,
				id: alertInstanceId,
				title: '[Triggered] High CPU Usage',
				message: 'CPU usage above 90%',
				alert_status: 'Triggered',
				alert_transition: 'Triggered',
				event_type: 'query_alert_monitor',
				link: 'https://app.datadoghq.com/monitors/123',
				tags: 'service:web,env:prod',
				alert_scope: 'service:web',
				date: '1765302826000',
				last_updated: '1765302826000',
				org: {
					id: '123456',
					name: 'Opsimate',
				},
			};

			const response = await app
				.post('/api/v1/alerts/custom/datadog')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.alertId).toBe(alertInstanceId);

			const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(payload.id);
			expect(row).toBeDefined();
			expect(row.alert_name).toBe(payload.title);
			expect(row.status).toBe('firing');

			// Validate tags mapping – primary tag should be derived from alert_scope / tags
			const parsedTags = row.tags ? JSON.parse(row.tags as string) : {};
			expect(parsedTags).toEqual({ service: 'web', env: 'prod' });
		});

		test('should archive an existing Datadog alert when alert_transition is recovered', async () => {
			const now = '1765302826000';
			const alertId = 'datadog-alert-archive';
			const alertInstanceId = 'datadog-alert-archive-1';

			const firingPayload = {
				id: alertInstanceId,
				alert_id: alertId,
				title: '[Triggered] Test Alert',
				message: 'Initial firing event',
				alert_status: 'Triggered',
				alert_transition: 'Triggered',
				event_type: 'query_alert_monitor',
				link: 'https://app.datadoghq.com/monitors/456',
				tags: 'service:test,env:dev',
				alert_scope: 'service:test',
				date: now,
				last_updated: now,
				org: {
					id: '123456',
					name: 'Opsimate',
				},
			};

			// First create the active alert
			const createResponse = await app
				.post('/api/v1/alerts/custom/datadog')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(firingPayload);

			expect(createResponse.status).toBe(200);
			expect(createResponse.body.success).toBe(true);

			const activeRow = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertInstanceId);
			expect(activeRow).toBeDefined();

			// Now send a recovered event for the same alert (only alert_transition matters)
			const recoveredPayload = {
				...firingPayload,
				alert_transition: 'Recovered',
				message: 'Alert has recovered',
			};

			const recoveredResponse = await app
				.post('/api/v1/alerts/custom/datadog')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(recoveredPayload);

			expect(recoveredResponse.status).toBe(200);
			expect(recoveredResponse.body.success).toBe(true);
			expect(recoveredResponse.body.data.alertId).toBe(alertInstanceId);

			const rowAfter = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertInstanceId);
			expect(rowAfter).toBeUndefined();

			const archivedRow = db.prepare('SELECT * FROM alerts_archived WHERE id = ?').get(alertInstanceId);
			expect(archivedRow).toBeDefined();
			expect(archivedRow.id).toBe(alertInstanceId);
		});

		test('should return 400 for invalid Datadog payload', async () => {
			const payload = {
				// Missing title
				alert_id: 'bad-datadog-alert',
			};

			const response = await app
				.post('/api/v1/alerts/custom/datadog')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(400);
			expect(response.body.error).toBeDefined();
		});

		test('should return 401 when no auth token is provided', async () => {
			const payload = {
				alert_id: 'unauthorized-datadog-alert',
				title: 'Unauthorized Datadog Alert',
				alert_status: 'Triggered',
			};

			const response = await app.post('/api/v1/alerts/custom/datadog').send(payload);

			expect(response.status).toBe(401);
			expect(response.body.success).toBe(false);
		});
	});

	describe('POST /api/v1/alerts/custom/uptimekuma', () => {
		const baseHeartbeat = {
			monitorID: 4,
			status: 0,
			time: new Date().toISOString(),
			msg: 'connect ECONNREFUSED',
			important: true,
			retries: 1,
			timezone: 'Asia/Jerusalem',
			timezoneOffset: '+02:00',
			localDateTime: '2025-11-29 17:20:31',
		};

		const baseMonitor = {
			id: 4,
			name: 'Test Monitor',
			description: null,
			path: ['Test Monitor'],
			pathName: 'Test Monitor',
			parent: null,
			childrenIDs: [],
			url: 'http://localhost:9999/health',
			method: 'GET',
			hostname: null,
			port: null,
			maxretries: 0,
			weight: 2000,
			active: true,
			forceInactive: false,
			type: 'http',
			timeout: 30,
			interval: 60,
			retryInterval: 60,
			resendInterval: 0,
			keyword: null,
			invertKeyword: false,
			expiryNotification: false,
			ignoreTls: false,
			upsideDown: false,
			packetSize: 56,
			maxredirects: 10,
			accepted_statuscodes: ['200-299'],
			dns_resolve_type: 'A',
			dns_resolve_server: '1.1.1.1',
			dns_last_result: null,
			docker_container: '',
			docker_host: null,
			proxyId: null,
			notificationIDList: { '2': true },
			tags: [],
			maintenance: false,
			mqttTopic: '',
			mqttSuccessMessage: '',
			mqttCheckType: 'keyword',
			databaseQuery: null,
			authMethod: null,
			grpcUrl: null,
			grpcProtobuf: null,
			grpcMethod: null,
			grpcServiceName: null,
			grpcEnableTls: false,
			radiusCalledStationId: null,
			radiusCallingStationId: null,
			game: null,
			gamedigGivenPortOnly: true,
			httpBodyEncoding: 'json',
			jsonPath: '$',
			expectedValue: null,
			kafkaProducerTopic: null,
			kafkaProducerBrokers: [],
			kafkaProducerSsl: false,
			kafkaProducerAllowAutoTopicCreation: false,
			kafkaProducerMessage: null,
			screenshot: null,
			cacheBust: false,
			remote_browser: null,
			snmpOid: null,
			jsonPathOperator: '==',
			snmpVersion: '2c',
			smtpSecurity: null,
			rabbitmqNodes: [],
			conditions: [],
			ipFamily: null,
			ping_numeric: true,
			ping_count: 3,
			ping_per_request_timeout: 2,
			includeSensitiveData: false,
		};

		// ---------------------------
		// TEST 1: Should create alert
		// ---------------------------
		test('should create an alert on DOWN status', async () => {
			const payload = {
				heartbeat: { ...baseHeartbeat, status: 0 },
				monitor: baseMonitor,
				msg: '[DOWN] ECONNREFUSED',
			};

			const response = await app
				.post('/api/v1/alerts/custom/uptimekuma')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.alertId).toBe('UPTIMEKUMA_4');

			const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get('UPTIMEKUMA_4');
			expect(row).toBeDefined();
			expect(row.alert_name).toBe(baseMonitor.pathName);
			expect(row.status).toBe('firing');
		});

		// --------------------------------------------------------
		// TEST 2: Should archive an existing alert on UP (status 1)
		// --------------------------------------------------------
		test('should archive alert on UP status', async () => {
			// First create alert
			db.prepare(
				`
                    INSERT INTO alerts (id, type, status, tags, starts_at, updated_at, alert_url, alert_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `
			).run(
				'UPTIMEKUMA_4',
				'UptimeKuma',
				'active',
				JSON.stringify({ tag: 'Test Monitor' }),
				new Date().toISOString(),
				new Date().toISOString(),
				baseMonitor.url,
				baseMonitor.name
			);

			const payload = {
				heartbeat: { ...baseHeartbeat, status: 1 },
				monitor: baseMonitor,
				msg: '[UP] recovered',
			};

			const response = await app
				.post('/api/v1/alerts/custom/uptimekuma')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(200);
			expect(response.body.data.alertId).toBe('UPTIMEKUMA_4');

			const archived = db.prepare('SELECT * FROM alerts_archived WHERE id = ?').get('UPTIMEKUMA_4');
			expect(archived).toBeDefined();

			const active = db.prepare('SELECT * FROM alerts WHERE id = ?').get('UPTIMEKUMA_4');
			expect(active).toBeUndefined();
		});

		// ----------------------------------
		// TEST 3: Missing fields = 400 error
		// ----------------------------------
		test('should return 400 for invalid payload (missing heartbeat)', async () => {
			const payload = {
				monitor: baseMonitor,
				msg: 'no heartbeat',
			};

			const response = await app
				.post('/api/v1/alerts/custom/uptimekuma')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send(payload);

			expect(response.status).toBe(200);
		});

		// ----------------------------------------
		// TEST 4: Unauthorized = 401 without token
		// ----------------------------------------
		test('should return 401 when no auth token is provided', async () => {
			const payload = {
				heartbeat: baseHeartbeat,
				monitor: baseMonitor,
				msg: 'unauthorized test',
			};

			const response = await app.post('/api/v1/alerts/custom/uptimekuma').send(payload);

			expect(response.status).toBe(401);
			expect(response.body.success).toBe(false);
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
			expect(row.status).toBe('firing');
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
			expect(row.status).toBe('firing');
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

			const archivedRow = db.prepare('SELECT * FROM alerts_archived WHERE id = ?').get(existingId);

			expect(archivedRow).toBeDefined();
			expect(archivedRow.id).toBe(existingId);
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
			expect(row.status).toBe('firing');

			// ISO 8601 regex: 2025-11-17T18:03:39.352Z
			const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

			expect(typeof row.starts_at).toBe('string');
			expect(row.starts_at).toMatch(isoRegex);

			expect(typeof row.updated_at).toBe('string');
			expect(row.updated_at).toMatch(isoRegex);
		});
	});

	describe('Archived Alerts API', () => {
		describe('GET /api/v1/alerts/archived', () => {
			test('should fetch all archived alerts successfully', async () => {
				const response = await app.get('/api/v1/alerts/archived').set('Authorization', `Bearer ${jwtToken}`);

				expect(response.status).toBe(200);
				expect(response.body.success).toBe(true);
				expect(Array.isArray(response.body.data.alerts)).toBe(true);
				expect(response.body.data.alerts.length).toBe(1);

				const alert = response.body.data.alerts[0];
				expect(alert.id).toBe(testAlertsArchived[0].id);
				expect(alert.alertName).toBe(testAlertsArchived[0].alertName);
			});

			test('should return empty array when no archived alerts exist', async () => {
				db.exec('DELETE FROM alerts_archived');

				const response = await app.get('/api/v1/alerts/archived').set('Authorization', `Bearer ${jwtToken}`);

				expect(response.status).toBe(200);
				expect(response.body.success).toBe(true);
				expect(response.body.data.alerts).toHaveLength(0);
			});

			test('should return 401 when no auth token is provided', async () => {
				const response = await app.get('/api/v1/alerts/archived');

				expect(response.status).toBe(401);
				expect(response.body.success).toBe(false);
			});
		});

		describe('Active to Archived transition', () => {
			test('should archive alert with resolved status when deleted', async () => {
				// Create a new alert
				const newAlertPayload = {
					id: 'alert-to-delete',
					status: 'active',
					tags: { tag: 'testing' },
					startsAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					alertUrl: 'https://example.com/delete-test',
					alertName: 'Alert to Delete',
					summary: 'This alert will be deleted',
					runbookUrl: 'https://runbook.com/delete',
					createdAt: new Date().toISOString(),
				};

				const createResponse = await app
					.post('/api/v1/alerts/custom')
					.set('Authorization', `Bearer ${jwtToken}`)
					.send(newAlertPayload);

				expect(createResponse.status).toBe(200);
				expect(createResponse.body.success).toBe(true);

				// Verify alert exists in active alerts table
				const activeRow = db.prepare('SELECT * FROM alerts WHERE id = ?').get(newAlertPayload.id);
				expect(activeRow).toBeDefined();

				// Delete the alert (this should archive it)
				const deleteResponse = await app
					.delete(`/api/v1/alerts/${newAlertPayload.id}`)
					.set('Authorization', `Bearer ${jwtToken}`);

				expect(deleteResponse.status).toBe(200);
				expect(deleteResponse.body.success).toBe(true);

				// Verify alert is removed from active alerts table
				const activeRowAfterDelete = db.prepare('SELECT * FROM alerts WHERE id = ?').get(newAlertPayload.id);
				expect(activeRowAfterDelete).toBeUndefined();

				// Verify alert is in archived alerts table with resolved status
				const archivedRow = db
					.prepare('SELECT * FROM alerts_archived WHERE id = ?')
					.get(newAlertPayload.id) as any;
				expect(archivedRow).toBeDefined();
				expect(archivedRow.id).toBe(newAlertPayload.id);
				expect(archivedRow.status).toBe('resolved');
				expect(archivedRow.alert_name).toBe(newAlertPayload.alertName);
				expect(archivedRow.archived_at).toBeDefined();
			});
		});

		describe('DELETE /api/v1/alerts/archived/:id', () => {
			test('should delete an archived alert successfully', async () => {
				const response = await app
					.delete(`/api/v1/alerts/archived/${testAlertsArchived[0].id}`)
					.set('Authorization', `Bearer ${jwtToken}`);

				expect(response.status).toBe(200);
				expect(response.body.success).toBe(true);

				const row = db.prepare('SELECT * FROM alerts_archived WHERE id = ?').get('archived-del-1');

				expect(row).toBeUndefined();
			});

			test('should return 401 when no auth token is provided', async () => {
				const response = await app.delete('/api/v1/alerts/archived/some-id');

				expect(response.status).toBe(401);
				expect(response.body.success).toBe(false);
			});
		});
	});
});
