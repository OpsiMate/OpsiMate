import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// The /metrics endpoint (issue #658): Prometheus text format, alert-state gauges
// computed from cheap SQL counts at scrape time, ingestion counter, request-duration
// histogram with matched-route labels, and optional bearer-token gating.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const insertAlert = (id: string, severity: string, dismissed: number) => {
	db.prepare(
		`INSERT INTO alerts (id, status, severity, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url, is_dismissed)
		 VALUES (?, 'firing', ?, '{}', ?, ?, 'https://example.com', ?, 'Summary', NULL, ?)`
	).run(id, severity, new Date().toISOString(), new Date().toISOString(), `Metric Alert ${id}`, dismissed);
};

const insertResolved = (id: string, severity: string) => {
	db.prepare(
		`INSERT INTO alerts_resolved (id, status, severity, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url, is_dismissed)
		 VALUES (?, 'resolved', ?, '{}', ?, ?, 'https://example.com', ?, 'Summary', NULL, 0)`
	).run(id, severity, new Date().toISOString(), new Date().toISOString(), `Resolved Alert ${id}`);
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
	insertAlert('m-1', 'critical', 0);
	insertAlert('m-2', 'critical', 0);
	insertAlert('m-3', 'warning', 1);
	insertResolved('m-r1', 'info');
});

// Restore rather than delete: a developer's own METRICS_TOKEN must survive the run.
const originalMetricsToken = process.env.METRICS_TOKEN;
afterEach(() => {
	if (originalMetricsToken === undefined) delete process.env.METRICS_TOKEN;
	else process.env.METRICS_TOKEN = originalMetricsToken;
});

describe('GET /metrics', () => {
	test('exposes alert-state gauges with firing/silenced/resolved naming', async () => {
		const res = await app.get('/metrics');
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toContain('text/plain');
		expect(res.text).toContain('opsimate_alerts{state="firing"} 2');
		expect(res.text).toContain('opsimate_alerts{state="silenced"} 1');
		expect(res.text).toContain('opsimate_alerts{state="resolved"} 1');
		expect(res.text).toContain('opsimate_alerts_by_severity{state="firing",severity="critical"} 2');
		expect(res.text).toContain('opsimate_alerts_by_severity{state="resolved",severity="info"} 1');
	});

	test('gauges track changes on the next scrape', async () => {
		insertAlert('m-4', 'info', 0);
		const res = await app.get('/metrics');
		expect(res.text).toContain('opsimate_alerts{state="firing"} 3');
		db.prepare(`DELETE FROM alerts WHERE id = 'm-4'`).run();
	});

	test('ingestion through the funnel increments the counter with type and severity', async () => {
		const res = await app
			.post('/api/v1/alerts/custom')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ id: 'ingest-1', alertName: 'Ingested', tags: { severity: 'critical' } });
		expect(res.status).toBeLessThan(300);

		const metrics = await app.get('/metrics');
		expect(metrics.text).toMatch(/opsimate_alerts_ingested_total\{type="Custom",severity="critical"\} [1-9]/);
	});

	test('request durations are recorded against the matched route pattern, not the raw URL', async () => {
		await app.get('/api/v1/alerts?limit=1').set('Authorization', `Bearer ${jwtToken}`);
		const metrics = await app.get('/metrics');
		expect(metrics.text).toContain('route="/api/v1/alerts/"');
		// No raw-query or per-id label values may appear.
		expect(metrics.text).not.toContain('limit=1');
	});

	test('includes default process metrics', async () => {
		const res = await app.get('/metrics');
		expect(res.text).toContain('process_cpu_user_seconds_total');
		expect(res.text).toContain('nodejs_eventloop_lag_seconds');
	});

	test('triage, age and resource gauges are exposed', async () => {
		const res = await app.get('/metrics');
		expect(res.text).toMatch(/opsimate_firing_alerts_unassigned \d+/);
		expect(res.text).toMatch(/opsimate_firing_alerts_unread \d+/);
		// Alerts inserted with starts_at=now: age is tiny but present and non-negative.
		expect(res.text).toMatch(/opsimate_oldest_firing_alert_age_seconds \d+/);
		expect(res.text).toMatch(/opsimate_resources\{kind="users"\} [1-9]/);
		expect(res.text).toMatch(/opsimate_resources\{kind="dashboards"\} \d+/);
	});

	test('resolve and bulk operations increment their counters', async () => {
		insertAlert('m-res', 'critical', 0);
		await app.delete('/api/v1/alerts/m-res').set('Authorization', `Bearer ${jwtToken}`);

		insertAlert('m-bulk', 'info', 0);
		await app
			.post('/api/v1/alerts/bulk')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ action: 'silence', ids: ['m-bulk'], silencedUntil: null });

		const metrics = await app.get('/metrics');
		expect(metrics.text).toMatch(/opsimate_alerts_resolved_total\{mode="manual"\} [1-9]/);
		expect(metrics.text).toMatch(/opsimate_bulk_actions_total\{action="silence"\} [1-9]/);
		expect(metrics.text).toMatch(/opsimate_bulk_alerts_affected_total\{action="silence"\} [1-9]/);
		expect(metrics.text).toMatch(/opsimate_alerts_silenced_total [1-9]/);
	});

	test('snapshot compute duration is observed once the list is read', async () => {
		await app.get('/api/v1/alerts?limit=1').set('Authorization', `Bearer ${jwtToken}`);
		const metrics = await app.get('/metrics');
		expect(metrics.text).toMatch(/opsimate_snapshot_compute_duration_seconds_count\{list="active"\} [1-9]/);
	});

	test('METRICS_TOKEN gates the endpoint when set', async () => {
		process.env.METRICS_TOKEN = 'scrape-secret';
		const denied = await app.get('/metrics');
		expect(denied.status).toBe(401);
		const allowed = await app.get('/metrics').set('Authorization', 'Bearer scrape-secret');
		expect(allowed.status).toBe(200);
	});
});
