import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, test } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// A source reports "resolved" for an alert OpsiMate never saw firing. With the full
// alert in the payload the episode is recorded (fired at startsAt — or at the resolve
// moment when absent — and resolved at endsAt or now). Resolved is then the alert's
// state AND the last status in its history, and a late, out-of-order firing of that
// same episode must not reopen it.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

interface IdRow {
	id: string;
	startsAt: string;
	severity: string;
}
interface ListBody {
	data: { alerts: IdRow[] };
}
interface HistoryEntry {
	date: string;
	status?: string;
	eventType?: string;
}
interface HistoryBody {
	data: { data: HistoryEntry[] };
}
interface CountRow {
	n: number;
}

const auth = (r: Test) => r.set('Authorization', `Bearer ${jwtToken}`);
const custom = (body: Record<string, unknown>) => auth(app.post('/api/v1/alerts/custom')).send(body);
const active = async () => ((await auth(app.get('/api/v1/alerts?limit=500'))).body as ListBody).data.alerts;
const resolved = async () => ((await auth(app.get('/api/v1/alerts/resolved?limit=500'))).body as ListBody).data.alerts;
const statusHistory = async (id: string) =>
	((await auth(app.get(`/api/v1/alerts/${id}/history`))).body as HistoryBody).data.data.filter(
		(e) => e.status !== undefined
	);
const historyRows = (id: string) =>
	(db.prepare(`SELECT COUNT(*) AS n FROM alerts_history WHERE alert_id = ?`).get(id) as CountRow).n;

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

describe('resolve with no firing alert (custom webhook)', () => {
	test('id-only: nothing to build the episode from — no-op', async () => {
		const res = await custom({ id: 'ro-idonly', status: 'resolved' });
		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ resolved: false, created: false });
		expect((await resolved()).map((a) => a.id)).not.toContain('ro-idonly');
		expect(historyRows('ro-idonly')).toBe(0);
	});

	test('no startsAt: recorded as resolved, and resolved is the last status in history', async () => {
		const before = Date.now();
		const res = await custom({
			id: 'ro-nostart',
			alertName: 'Disk full',
			tags: { env: 'prod' },
			status: 'resolved',
		});
		expect(res.body.data).toMatchObject({ resolved: false, created: true });

		// State: resolved, not firing.
		expect((await active()).map((a) => a.id)).not.toContain('ro-nostart');
		const record = (await resolved()).find((a) => a.id === 'ro-nostart');
		expect(record).toBeDefined();

		// History: exactly one firing and one resolved, same instant, resolved newest.
		const history = await statusHistory('ro-nostart');
		expect(history.map((e) => e.status)).toEqual(['resolved', 'firing']);
		expect(history[0].date).toBe(history[1].date);
		const at = new Date(history[0].date).getTime();
		expect(at).toBeGreaterThanOrEqual(before - 1000);
		expect(at).toBeLessThanOrEqual(Date.now() + 1000);
		expect(record?.startsAt && new Date(record.startsAt).getTime()).toBe(at);
	});

	test('startsAt and endsAt given: fired at startsAt, resolved at endsAt', async () => {
		await custom({
			id: 'ro-window',
			alertName: 'CPU high',
			tags: {},
			status: 'resolved',
			startsAt: '2026-09-20T10:00:00.000Z',
			endsAt: '2026-09-20T10:30:00.000Z',
		});
		const history = await statusHistory('ro-window');
		expect(history).toMatchObject([
			{ status: 'resolved', date: '2026-09-20T10:30:00.000Z' },
			{ status: 'firing', date: '2026-09-20T10:00:00.000Z' },
		]);
	});

	test('bad clocks are clamped, not rejected: a start after the end, and a future end', async () => {
		await custom({
			id: 'ro-clamp',
			alertName: 'clamped',
			tags: {},
			status: 'resolved',
			startsAt: '2030-01-01T00:00:00.000Z',
			endsAt: '2031-01-01T00:00:00.000Z',
		});
		const history = await statusHistory('ro-clamp');
		expect(history.map((e) => e.status)).toEqual(['resolved', 'firing']);
		expect(new Date(history[0].date).getTime()).toBeLessThanOrEqual(Date.now());
		expect(history[1].date).toBe(history[0].date);
	});

	test('severity is normalized like any other ingest', async () => {
		await custom({ id: 'ro-sev', alertName: 'sev', tags: {}, severity: 'P1', status: 'resolved' });
		expect((await resolved()).find((a) => a.id === 'ro-sev')?.severity).toBe('critical');
	});

	test('a second resolve for the same id changes nothing', async () => {
		const rows = historyRows('ro-nostart');
		const again = await custom({ id: 'ro-nostart', alertName: 'Disk full', tags: {}, status: 'resolved' });
		expect(again.body.data).toMatchObject({ resolved: false, created: false });
		expect(historyRows('ro-nostart')).toBe(rows);
	});

	test('the late firing of that episode (older start) does not reopen it', async () => {
		await custom({
			id: 'ro-late',
			alertName: 'late',
			tags: {},
			status: 'resolved',
			startsAt: new Date(Date.now() - 120_000).toISOString(),
		});
		const late = await custom({
			id: 'ro-late',
			alertName: 'late',
			tags: {},
			startsAt: new Date(Date.now() - 120_000).toISOString(),
		});
		expect(late.status).toBe(200);
		expect((await active()).map((a) => a.id)).not.toContain('ro-late');
		expect((await resolved()).map((a) => a.id)).toContain('ro-late');
		expect((await statusHistory('ro-late'))[0].status).toBe('resolved');
	});

	test('a firing that starts after the resolve is a new episode and fires', async () => {
		await custom({ id: 'ro-new', alertName: 'new', tags: {}, status: 'resolved' });
		await custom({
			id: 'ro-new',
			alertName: 'new',
			tags: {},
			startsAt: new Date(Date.now() + 5_000).toISOString(),
		});
		expect((await active()).map((a) => a.id)).toContain('ro-new');
		expect((await resolved()).map((a) => a.id)).not.toContain('ro-new');
	});

	test('an unparseable endsAt does not discard the episode — it resolves now', async () => {
		const res = await custom({
			id: 'ro-badend',
			alertName: 'bad end',
			tags: {},
			status: 'resolved',
			endsAt: 'soon-ish',
		});
		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ created: true });
		const history = await statusHistory('ro-badend');
		expect(history.map((e) => e.status)).toEqual(['resolved', 'firing']);
		expect(Math.abs(new Date(history[0].date).getTime() - Date.now())).toBeLessThan(5_000);
	});

	test('two concurrent resolves for the same unknown id create exactly one episode, without errors', async () => {
		const body = { id: 'ro-race', alertName: 'race', tags: {}, status: 'resolved' };
		const [a, b] = await Promise.all([custom(body), custom(body)]);
		expect([a.status, b.status]).toEqual([200, 200]);
		expect([a.body.data.created, b.body.data.created].filter(Boolean)).toHaveLength(1);
		expect(historyRows('ro-race')).toBe(2);
	});

	test('a resolve delivered late (old endsAt) still blocks the retried firing of its episode', async () => {
		const start = new Date(Date.now() - 60 * 60_000).toISOString(); // an hour ago
		const end = new Date(Date.now() - 30 * 60_000).toISOString(); // ended 30 min ago — past the window
		await custom({
			id: 'ro-lateresolve',
			alertName: 'late resolve',
			tags: {},
			status: 'resolved',
			startsAt: start,
			endsAt: end,
		});
		await custom({ id: 'ro-lateresolve', alertName: 'late resolve', tags: {}, startsAt: start });
		expect((await active()).map((a) => a.id)).not.toContain('ro-lateresolve');
		expect((await statusHistory('ro-lateresolve'))[0].status).toBe('resolved');
	});

	test('a normal resolve of a firing alert is unchanged', async () => {
		await custom({ id: 'ro-normal', alertName: 'normal', tags: {} });
		const res = await custom({ id: 'ro-normal', alertName: 'normal', tags: {}, status: 'resolved' });
		expect(res.body.data).toMatchObject({ resolved: true, created: false });
		expect((await statusHistory('ro-normal'))[0].status).toBe('resolved');
	});

	test('Insights counts the no-start episode as resolved, not firing', async () => {
		const res = await auth(app.get('/api/v1/alerts/analytics?tz=UTC'));
		expect(res.status).toBe(200);
		const byName = res.body.data.byName as { name: string; firingNow: number; episodes: number }[];
		expect(byName.find((row) => row.name === 'Disk full')).toMatchObject({ episodes: 1, firingNow: 0 });
	});
});

describe('resolve with no firing alert (Grafana webhook)', () => {
	test('a resolved Grafana alert we never saw firing is recorded, resolved last', async () => {
		const res = await auth(app.post('/api/v1/alerts/custom/grafana')).send({
			status: 'resolved',
			alerts: [
				{
					status: 'resolved',
					fingerprint: 'graf-ro-1',
					labels: { alertname: 'Grafana never fired', instance: 'i1' },
					annotations: { summary: 'g' },
					startsAt: '2026-09-21T08:00:00Z',
					endsAt: '2026-09-21T08:05:00Z',
				},
			],
		});
		expect(res.status).toBe(200);
		expect((await resolved()).map((a) => a.id)).toContain('graf-ro-1');
		expect(await statusHistory('graf-ro-1')).toMatchObject([
			{ status: 'resolved', date: '2026-09-21T08:05:00.000Z' },
			{ status: 'firing', date: '2026-09-21T08:00:00.000Z' },
		]);
	});
});

describe('history trigger upgrade on existing installs', () => {
	interface TriggerSql {
		sql: string;
	}
	test('old second-precision triggers are replaced, and a same-second resolve sorts after its firing', async () => {
		const legacy = await setupDB();
		await setupExpressApp(legacy);
		// Put back the pre-upgrade definitions, as an existing install would have them.
		legacy.exec(`
			DROP TRIGGER archive_alert_history_on_insert;
			CREATE TRIGGER archive_alert_history_on_insert AFTER INSERT ON alerts_resolved FOR EACH ROW
			BEGIN INSERT INTO alerts_history (alert_id, status) VALUES (NEW.id, NEW.status); END;
		`);
		const legacyApp = await setupExpressApp(legacy); // re-runs the table init
		const sql = (
			legacy
				.prepare(`SELECT sql FROM sqlite_master WHERE name = 'archive_alert_history_on_insert'`)
				.get() as TriggerSql
		).sql;
		expect(sql).toContain('strftime');

		const token = await setupUserWithToken(legacyApp);
		const send = (body: Record<string, unknown>) =>
			legacyApp.post('/api/v1/alerts/custom').set('Authorization', `Bearer ${token}`).send(body);
		await send({ id: 'fast', alertName: 'fast', tags: {}, startsAt: new Date().toISOString() });
		await send({ id: 'fast', status: 'resolved' });
		const history = (
			(await legacyApp.get('/api/v1/alerts/fast/history').set('Authorization', `Bearer ${token}`))
				.body as HistoryBody
		).data.data.filter((e) => e.status !== undefined);
		expect(history[0].status).toBe('resolved');
	});
});
