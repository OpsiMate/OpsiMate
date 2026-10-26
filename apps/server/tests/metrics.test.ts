import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
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

describe('metric regression coverage', () => {
	const HOUR_MS = 60 * 60 * 1000;

	interface AlertSilenceRow {
		is_dismissed: number;
	}

	const insertSilencedAlert = (id: string, silencedUntil: string | null) => {
		const now = new Date().toISOString();
		db.prepare(
			`INSERT INTO alerts (id, status, tags, starts_at, updated_at, alert_url, alert_name, summary, is_dismissed, silenced_until, silenced_at)
			 VALUES (?, 'firing', '{}', ?, ?, ?, ?, 'Summary', 1, ?, ?)`
		).run(id, now, now, `https://example.com/${id}`, `Metric Alert ${id}`, silencedUntil, now);
	};

	const scrape = async (): Promise<string> => {
		const response = await app.get('/metrics');
		expect(response.status).toBe(200);
		return response.text;
	};

	const sample = (text: string, name: string): number => {
		const match = text.match(new RegExp(`^${name} (\\S+)$`, 'm'));
		expect(match, `Missing sample: ${name}`).not.toBeNull();
		const value = Number(match?.[1]);
		expect(Number.isFinite(value)).toBe(true);
		return value;
	};

	const isSilenced = (id: string): number | undefined =>
		db.prepare<[string], AlertSilenceRow>('SELECT is_dismissed FROM alerts WHERE id = ?').get(id)?.is_dismissed;

	beforeEach(() => {
		// Isolate these cases from the original m-3 silence and prior alert writes.
		db.exec('DELETE FROM alerts');
		db.exec('DELETE FROM silence_reset_config');
	});

	afterEach(() => {
		// The opt-in daily reset must not leak into any later test.
		db.exec('DELETE FROM silence_reset_config');
	});

	test('manual unsilence increments the counter by exactly one', async () => {
		insertSilencedAlert('metric-manual', null);
		const before = sample(await scrape(), 'opsimate_alerts_unsilenced_total');
		const response = await app
			.patch('/api/v1/alerts/metric-manual/unsilence')
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(response.status).toBe(200);
		expect(sample(await scrape(), 'opsimate_alerts_unsilenced_total') - before).toBe(1);
		expect(isSilenced('metric-manual')).toBe(0);
	});

	test('unsilencing a missing alert returns 404 without moving the counter', async () => {
		const before = sample(await scrape(), 'opsimate_alerts_unsilenced_total');
		const response = await app
			.patch('/api/v1/alerts/metric-missing/unsilence')
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(response.status).toBe(404);
		expect(sample(await scrape(), 'opsimate_alerts_unsilenced_total') - before).toBe(0);
	});

	test('timer expiry counts exactly the two expired silences and leaves the future silence', async () => {
		insertSilencedAlert('metric-expired-a', new Date(Date.now() - HOUR_MS).toISOString());
		insertSilencedAlert('metric-expired-b', new Date(Date.now() - HOUR_MS).toISOString());
		insertSilencedAlert('metric-future', new Date(Date.now() + HOUR_MS).toISOString());
		const before = sample(await scrape(), 'opsimate_alerts_unsilenced_total');
		const response = await app.get('/api/v1/alerts').set('Authorization', `Bearer ${jwtToken}`);
		expect(response.status).toBe(200);
		expect(sample(await scrape(), 'opsimate_alerts_unsilenced_total') - before).toBe(2);
		expect(isSilenced('metric-expired-a')).toBe(0);
		expect(isSilenced('metric-expired-b')).toBe(0);
		expect(isSilenced('metric-future')).toBe(1);
	});

	test('daily reset counts the old silence once and preserves a silence established after the hour', async () => {
		// Keep HTTP scheduling real while the server-local reset cutoff stays fixed.
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			vi.setSystemTime(new Date(2026, 0, 15, 12, 30));
			insertSilencedAlert('metric-reset-old', null);
			insertSilencedAlert('metric-reset-new', null);
			db.prepare('UPDATE alerts SET silenced_at = ? WHERE id = ?').run(
				new Date(Date.now() - 24 * HOUR_MS).toISOString(),
				'metric-reset-old'
			);
			const before = sample(await scrape(), 'opsimate_alerts_unsilenced_total');
			const settings = await app
				.put('/api/v1/alerts/silence-reset')
				.set('Authorization', `Bearer ${jwtToken}`)
				.send({ enabled: true, hour: new Date().getHours() });
			expect(settings.status).toBe(200);
			const response = await app.get('/api/v1/alerts').set('Authorization', `Bearer ${jwtToken}`);
			expect(response.status).toBe(200);
			expect(sample(await scrape(), 'opsimate_alerts_unsilenced_total') - before).toBe(1);
			expect(isSilenced('metric-reset-old')).toBe(0);
			expect(isSilenced('metric-reset-new')).toBe(1);
			const second = await app.get('/api/v1/alerts').set('Authorization', `Bearer ${jwtToken}`);
			expect(second.status).toBe(200);
			expect(sample(await scrape(), 'opsimate_alerts_unsilenced_total') - before).toBe(1);
		} finally {
			vi.useRealTimers();
		}
	});

	test('a single custom alert increments ingest batch count and sum by one', async () => {
		const before = await scrape();
		const response = await app
			.post('/api/v1/alerts/custom')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ id: 'metric-batch', alertName: 'Metric batch', tags: { severity: 'critical' } });
		expect(response.status).toBeLessThan(300);
		const after = await scrape();
		for (const metric of ['opsimate_ingest_batch_size_count', 'opsimate_ingest_batch_size_sum']) {
			expect(sample(after, metric) - sample(before, metric)).toBe(1);
		}
	});

	test('event-loop utilization is finite and within zero to one on consecutive scrapes', async () => {
		for (let index = 0; index < 2; index++) {
			const value = sample(await scrape(), 'opsimate_event_loop_utilization');
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});

	test('an unmatched 404 increments the shared route series without exposing the raw path', async () => {
		const pattern =
			/^opsimate_http_request_duration_seconds_count\{(?=[^}\n]*method="GET")(?=[^}\n]*route="unmatched")(?=[^}\n]*status_code="404")[^}\n]*\} (\S+)$/m;
		const before = Number((await scrape()).match(pattern)?.[1] ?? 0);
		const response = await app.get('/no-such-path');
		expect(response.status).toBe(404);
		const after = await scrape();
		const match = after.match(pattern);
		expect(match).not.toBeNull();
		expect(Number(match?.[1]) - before).toBe(1);
		expect(after).not.toContain('no-such-path');
	});
});
