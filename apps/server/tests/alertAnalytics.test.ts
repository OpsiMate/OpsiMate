import { Alert } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { SuperTest, Test } from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { AnalyticsInputs, computeAlertAnalytics, EpisodeRow } from '../src/bl/analytics/computeAlertAnalytics';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// Pure-function tests over hand-built histories: episode pairing, window scoping,
// previous-period deltas, and each reliability metric's exact semantics.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Fixed "now" so windows are deterministic.
const NOW = Date.parse('2026-08-20T12:00:00.000Z');
const iso = (ms: number): string => new Date(ms).toISOString();

const alert = (id: string, name: string, severity: string, tags: Record<string, string> = {}): Alert =>
	({ id, alertName: name, severity, tags, isSilenced: false }) as Alert;

const firing = (alertId: string, ms: number): EpisodeRow => ({ alertId, status: 'firing', at: iso(ms) });
const resolved = (alertId: string, ms: number): EpisodeRow => ({ alertId, status: 'resolved', at: iso(ms) });

const compute = (partial: Partial<AnalyticsInputs>) =>
	computeAlertAnalytics({
		episodes: [],
		events: [],
		activeAlerts: [],
		resolvedAlerts: [],
		from: iso(NOW - 7 * DAY),
		to: iso(NOW),
		timeZone: 'UTC',
		...partial,
	});

// HTTP contract: the endpoint exists behind auth, parses its params through zod, and
// rejects an inverted window. (A unit-only suite once missed an unimported schema
// symbol that compiled but threw at request time — this is the guard against that.)
describe('GET /alerts/analytics', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let jwtToken: string;

	beforeAll(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		jwtToken = await setupUserWithToken(app);
		db.prepare(
			`INSERT INTO alerts (id, status, severity, tags, starts_at, updated_at, alert_url, alert_name, summary, is_dismissed)
			 VALUES ('an-1', 'firing', 'warning', '{}', '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z', 'https://x', 'Analytics probe', 'S', 0)`
		).run();
	});

	test('returns the aggregate payload', async () => {
		const res = await app.get('/api/v1/alerts/analytics?tz=UTC').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.data.overview.totalEpisodes.value).toBeGreaterThanOrEqual(1);
		expect(res.body.data.reliability).toBeDefined();
		expect(Array.isArray(res.body.data.byName)).toBe(true);
	});

	test('rejects an inverted window and malformed timestamps with 400', async () => {
		const inverted = await app
			.get('/api/v1/alerts/analytics?from=2026-08-19T00:00:00.000Z&to=2026-08-01T00:00:00.000Z')
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(inverted.status).toBe(400);
		const garbage = await app
			.get('/api/v1/alerts/analytics?from=not-a-date')
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(garbage.status).toBe(400);
	});

	test('filters scope the aggregates', async () => {
		const filters = encodeURIComponent(JSON.stringify({ alertName: ['Analytics probe'] }));
		const res = await app
			.get(`/api/v1/alerts/analytics?tz=UTC&filters=${filters}`)
			.set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.data.range.filtered).toBe(true);
		expect(res.body.data.overview.topAlertNames.every((n: { name: string }) => n.name === 'Analytics probe')).toBe(
			true
		);
	});
});

describe('computeAlertAnalytics', () => {
	test('episodes pair firing with the next resolution; MTTR measures exactly that span', () => {
		const result = compute({
			episodes: [
				firing('a', NOW - 10 * HOUR),
				resolved('a', NOW - 8 * HOUR), // 2h episode
				firing('a', NOW - 6 * HOUR),
				resolved('a', NOW - 2 * HOUR), // 4h episode
			],
			resolvedAlerts: [alert('a', 'DB latency', 'warning')],
		});
		expect(result.overview.totalEpisodes.value).toBe(2);
		expect(result.overview.resolvedInRange.value).toBe(2);
		expect(result.reliability.mttr.count).toBe(2);
		expect(result.reliability.mttr.meanMs).toBe(3 * HOUR);
		expect(result.reliability.mttr.medianMs).toBe(2 * HOUR);
	});

	test('an unresolved firing (re-fire without resolution row) closes open-ended', () => {
		const result = compute({
			episodes: [firing('a', NOW - 10 * HOUR), firing('a', NOW - 5 * HOUR)],
			activeAlerts: [alert('a', 'Flappy', 'critical')],
		});
		// Two episodes, zero resolutions — nothing leaks into MTTR.
		expect(result.overview.totalEpisodes.value).toBe(2);
		expect(result.reliability.mttr.count).toBe(0);
		expect(result.reliability.mttr.meanMs).toBeNull();
	});

	test('window scoping: only episodes started inside [from, to] count, previous period fills the delta', () => {
		const result = compute({
			episodes: [
				firing('a', NOW - 10 * DAY), // previous window (7-14d ago)
				firing('a', NOW - 9 * DAY),
				firing('a', NOW - 2 * DAY), // current window
			],
			activeAlerts: [alert('a', 'X', 'info')],
		});
		expect(result.overview.totalEpisodes.value).toBe(1);
		expect(result.overview.totalEpisodes.previous).toBe(2);
	});

	test('All time has no previous period', () => {
		const result = compute({
			episodes: [firing('a', NOW - 30 * DAY)],
			activeAlerts: [alert('a', 'X', 'info')],
			from: null,
		});
		expect(result.overview.totalEpisodes.value).toBe(1);
		expect(result.overview.totalEpisodes.previous).toBeNull();
		expect(result.range.previousFrom).toBeNull();
	});

	test('MTTA is first human touch inside the episode; untouched episodes lower ack coverage', () => {
		const result = compute({
			episodes: [firing('a', NOW - 10 * HOUR), resolved('a', NOW - 8 * HOUR), firing('b', NOW - 4 * HOUR)],
			events: [
				{ alertId: 'a', at: iso(NOW - 9 * HOUR) }, // 1h after a's start — counts
				{ alertId: 'b', at: iso(NOW - 20 * HOUR) }, // BEFORE b started — must not count
			],
			activeAlerts: [alert('b', 'B', 'warning')],
			resolvedAlerts: [alert('a', 'A', 'warning')],
		});
		expect(result.reliability.mtta.count).toBe(1);
		expect(result.reliability.mtta.meanMs).toBe(1 * HOUR);
		expect(result.reliability.ackCoverage.acked).toBe(1);
		expect(result.reliability.ackCoverage.episodes).toBe(2);
	});

	test('re-fire rate counts resolutions the same alert re-fired within 24h of', () => {
		const result = compute({
			episodes: [
				firing('a', NOW - 30 * HOUR),
				resolved('a', NOW - 28 * HOUR),
				firing('a', NOW - 27 * HOUR), // 1h after resolution -> refire
				resolved('a', NOW - 26 * HOUR),
				firing('b', NOW - 30 * HOUR),
				resolved('b', NOW - 29 * HOUR), // never re-fired
			],
			resolvedAlerts: [alert('a', 'A', 'warning'), alert('b', 'B', 'warning')],
		});
		expect(result.reliability.refireRate.resolutions).toBe(3);
		expect(result.reliability.refireRate.refired).toBe(1);
		expect(result.reliability.refireRate.rate).toBeCloseTo(1 / 3);
	});

	test('MTBF averages gaps between consecutive firings of the same alert', () => {
		const result = compute({
			episodes: [
				firing('a', NOW - 10 * HOUR),
				firing('a', NOW - 6 * HOUR), // 4h gap
				firing('a', NOW - 4 * HOUR), // 2h gap
			],
			activeAlerts: [alert('a', 'A', 'warning')],
		});
		expect(result.reliability.mtbf.meanMs).toBe(3 * HOUR);
		expect(result.reliability.mtbf.alertsMeasured).toBe(1);
	});

	test('severity, top names and top tags aggregate over window episodes', () => {
		const result = compute({
			episodes: [firing('a', NOW - HOUR), firing('a', NOW - 2 * HOUR), firing('b', NOW - 3 * HOUR)],
			activeAlerts: [
				alert('a', 'DB latency', 'critical', { env: 'prod', service: 'db' }),
				alert('b', 'Disk full', 'info', { env: 'prod' }),
			],
		});
		expect(result.overview.severity).toEqual([
			{ severity: 'critical', count: 2 },
			{ severity: 'info', count: 1 },
		]);
		expect(result.overview.topAlertNames[0]).toEqual({ name: 'DB latency', count: 2 });
		expect(result.overview.topTags[0]).toEqual({ name: 'env=prod', count: 2 });
	});

	test('per-name table groups ids sharing a name and rolls their stats up', () => {
		const result = compute({
			episodes: [
				firing('a1', NOW - 10 * HOUR),
				resolved('a1', NOW - 8 * HOUR),
				firing('a2', NOW - 6 * HOUR),
				resolved('a2', NOW - 2 * HOUR),
			],
			activeAlerts: [],
			resolvedAlerts: [alert('a1', 'Same name', 'warning'), alert('a2', 'Same name', 'critical')],
		});
		expect(result.byName).toHaveLength(1);
		const row = result.byName[0];
		expect(row.name).toBe('Same name');
		expect(row.episodes).toBe(2);
		expect(row.mttrMs).toBe(3 * HOUR);
		expect(row.worstSeverity).toBe('critical');
	});

	test('an event after a NEXT episode started never attributes to an earlier unresolved episode', () => {
		const result = compute({
			episodes: [
				firing('a', NOW - 10 * HOUR), // unresolved episode 1
				firing('a', NOW - 5 * HOUR), // episode 2
			],
			// The only event happened during episode 2; episode 1 must stay untouched.
			events: [{ alertId: 'a', at: iso(NOW - 4 * HOUR) }],
			activeAlerts: [alert('a', 'A', 'warning')],
		});
		expect(result.reliability.ackCoverage.acked).toBe(1);
		expect(result.reliability.mtta.count).toBe(1);
		expect(result.reliability.mtta.meanMs).toBe(1 * HOUR);
	});

	test('a dashboard filter scopes everything to the allowed alerts', () => {
		const result = compute({
			episodes: [firing('a', NOW - 2 * HOUR), resolved('a', NOW - HOUR), firing('b', NOW - 3 * HOUR)],
			events: [
				{ alertId: 'a', at: iso(NOW - 90 * 60 * 1000), actorName: 'idan' },
				{ alertId: 'b', at: iso(NOW - 2 * HOUR), actorName: 'someone-else' },
			],
			activeAlerts: [alert('b', 'Excluded', 'critical')],
			resolvedAlerts: [alert('a', 'Included', 'warning')],
			allowedAlertIds: new Set(['a']),
		});
		expect(result.overview.totalEpisodes.value).toBe(1);
		expect(result.overview.topAlertNames).toEqual([{ name: 'Included', count: 1 }]);
		// firingNow counts only allowed active alerts; b is filtered out.
		expect(result.overview.firingNow).toBe(0);
		// Responders scoped too: someone-else acted on the excluded alert.
		expect(result.overview.topResponders).toEqual([{ name: 'idan', count: 1 }]);
		expect(result.range.filtered).toBe(true);
	});

	test('resolutions land on their local day as the volume overlay and the MTTR trend', () => {
		const start = Date.parse('2026-08-19T10:00:00.000Z');
		const result = compute({
			episodes: [firing('a', start), resolved('a', start + 2 * HOUR)],
			resolvedAlerts: [alert('a', 'A', 'warning')],
		});
		const day = result.overview.volumeByDay.find((d) => d.date === '2026-08-19');
		expect(day?.resolved).toBe(1);
		expect(result.reliability.mttrByDay).toEqual([{ date: '2026-08-19', meanMs: 2 * HOUR, count: 1 }]);
	});

	test('weekday histogram buckets episodes by local day of week', () => {
		// 2026-08-19 is a Wednesday (UTC).
		const result = compute({
			episodes: [firing('a', Date.parse('2026-08-19T10:00:00.000Z'))],
			activeAlerts: [alert('a', 'A', 'warning')],
		});
		const nonZero = result.overview.volumeByWeekday.filter((w) => w.count > 0);
		expect(nonZero).toEqual([{ weekday: 3, count: 1 }]);
	});

	test('hour histogram buckets in the requested timezone', () => {
		// 23:30 UTC = 02:30 in Athens summer time (UTC+3) — the histogram must say hour 2, not 23.
		const at = Date.parse('2026-08-19T23:30:00.000Z');
		const result = compute({
			episodes: [firing('a', at)],
			activeAlerts: [alert('a', 'A', 'warning')],
			timeZone: 'Europe/Athens',
		});
		const nonZero = result.overview.volumeByHour.filter((h) => h.count > 0);
		expect(nonZero).toEqual([{ hour: 2, count: 1 }]);
	});
});
