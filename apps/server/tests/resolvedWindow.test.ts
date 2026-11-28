import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';
import { ResolvedAlertRepository } from '../src/dal/resolvedAlertRepository';

// The hot resolved list holds only the last ALERTS_RESOLVED_WINDOW_DAYS of resolved
// alerts; older ones are served from the archive list when a query's window reaches
// past the cutoff. These tests pin that split at the HTTP layer, and that the archive
// is read only when asked for (the per-click cost must not grow with old history).

interface AlertIdRow {
	id: string;
}

interface PageBody {
	data: { alerts: AlertIdRow[]; total: number };
}

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number): Date => new Date(Date.now() - days * DAY_MS);
// What the resolve path writes: SQLite's CURRENT_TIMESTAMP form.
const sqliteStamp = (date: Date): string => date.toISOString().slice(0, 19).replace('T', ' ');

const insertResolved = (id: string, archivedAt: Date, archivedAtText = sqliteStamp(archivedAt)) => {
	const iso = archivedAt.toISOString();
	db.prepare(
		`INSERT INTO alerts_resolved (id, status, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url, is_dismissed, created_at, archived_at)
		 VALUES (?, 'resolved', '{}', ?, ?, ?, ?, 'Summary', NULL, 0, ?, ?)`
	).run(id, iso, iso, `https://example.com/${id}`, id, iso, archivedAtText);
};

const listResolved = (params: Record<string, string> = {}) =>
	app
		.get('/api/v1/alerts/resolved')
		.query({ sort: 'startsAt', dir: 'desc', limit: '100', ...params })
		.set('Authorization', `Bearer ${jwtToken}`);

const ids = (body: PageBody): string[] => body.data.alerts.map((alert) => alert.id).sort();

beforeAll(async () => {
	process.env.ALERTS_RESOLVED_WINDOW_DAYS = '30';
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
	insertResolved('recent-1', daysAgo(1));
	insertResolved('recent-20', daysAgo(20));
	// ISO-stamped on the cutoff's own day (the resolve-only episode path writes ISO).
	insertResolved('iso-on-cutoff-day', daysAgo(29.5), daysAgo(29.5).toISOString());
	insertResolved('old-45', daysAgo(45));
	insertResolved('old-400', daysAgo(400));
});

afterAll(() => {
	delete process.env.ALERTS_RESOLVED_WINDOW_DAYS;
});

describe('resolved window', () => {
	test('a window that starts inside the hot cutoff is answered from the hot list', async () => {
		const sinceSpy = vi.spyOn(ResolvedAlertRepository.prototype, 'getResolvedAlertsSince');
		const allSpy = vi.spyOn(ResolvedAlertRepository.prototype, 'getAllResolvedAlerts');
		const res = await listResolved({ from: daysAgo(25).toISOString() });
		expect(res.status).toBe(200);
		expect(ids(res.body)).toEqual(['recent-1', 'recent-20']);
		expect(sinceSpy).toHaveBeenCalled();
		expect(allSpy).not.toHaveBeenCalled();
		sinceSpy.mockRestore();
		allSpy.mockRestore();
	});

	test('the hot list keeps an ISO-stamped row from the cutoff day', async () => {
		const res = await listResolved({ from: daysAgo(30).toISOString() });
		expect(res.status).toBe(200);
		expect(ids(res.body)).toContain('iso-on-cutoff-day');
	});

	test('no window at all reads the archive: every resolved alert, old ones included', async () => {
		const allSpy = vi.spyOn(ResolvedAlertRepository.prototype, 'getAllResolvedAlerts');
		const res = await listResolved();
		expect(res.status).toBe(200);
		expect(ids(res.body)).toEqual(['iso-on-cutoff-day', 'old-400', 'old-45', 'recent-1', 'recent-20']);
		expect(allSpy).toHaveBeenCalled();
		allSpy.mockRestore();
	});

	test('a window that starts before the cutoff reads the archive and finds the old alert', async () => {
		const res = await listResolved({ from: daysAgo(60).toISOString(), to: daysAgo(40).toISOString() });
		expect(res.status).toBe(200);
		expect(ids(res.body)).toEqual(['old-45']);
	});

	test('the parameterless snapshot read is the archive', async () => {
		const res = await app.get('/api/v1/alerts/resolved').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.data.alerts.map((alert: AlertIdRow) => alert.id)).toContain('old-400');
	});

	test('resolved facets describe the hot window only', async () => {
		const res = await app
			.get('/api/v1/alerts/resolved/facets')
			.query({ filters: '{}' })
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.data.total).toBe(3);
	});

	test('with the window set to 0 everything is hot and the archive is never built', async () => {
		process.env.ALERTS_RESOLVED_WINDOW_DAYS = '0';
		const sinceSpy = vi.spyOn(ResolvedAlertRepository.prototype, 'getResolvedAlertsSince');
		const res = await listResolved({ from: daysAgo(60).toISOString() });
		expect(res.status).toBe(200);
		expect(ids(res.body)).toEqual(['iso-on-cutoff-day', 'old-45', 'recent-1', 'recent-20']);
		expect(sinceSpy).not.toHaveBeenCalled();
		sinceSpy.mockRestore();
		process.env.ALERTS_RESOLVED_WINDOW_DAYS = '30';
	});

	test('the hot read uses the archived_at index, not a table scan', () => {
		const plan = db
			.prepare(
				`EXPLAIN QUERY PLAN
				 SELECT * FROM alerts_resolved WHERE archived_at >= ? ORDER BY archived_at DESC`
			)
			.all('2026-01-01 00:00:00') as { detail: string }[];
		const details = plan.map((row) => row.detail).join(' | ');
		expect(details).toContain('USING INDEX idx_alerts_resolved_archived_at');
		expect(details).not.toContain('SCAN alerts_resolved');
	});
});
