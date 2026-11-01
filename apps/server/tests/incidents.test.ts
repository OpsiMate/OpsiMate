import Database from 'better-sqlite3';
import { SuperTest, Test } from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// HTTP + persistence contract of the incidents feature: grouping, exclusivity
// (one incident per alert, re-homing moves), roll-ups over both alert tables,
// dissolution when emptied, incidentId attached to alert list responses,
// membership survival across resolve but not delete-forever, and ownership: the
// creator owns the incident and its unowned members, and unassigning leaves it.

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const insertAlert = (id: string, name: string, severity: string, startsAt: string) => {
	db.prepare(
		`INSERT INTO alerts (id, status, severity, tags, starts_at, updated_at, alert_url, alert_name, summary, is_dismissed)
		 VALUES (?, 'firing', ?, '{}', ?, ?, ?, ?, 'Summary', 0)`
	).run(id, severity, startsAt, new Date().toISOString(), `https://example.com/${id}`, name);
};

const insertResolvedAlert = (id: string, name: string, severity: string) => {
	db.prepare(
		`INSERT INTO alerts_resolved (id, status, severity, tags, starts_at, updated_at, alert_url, alert_name, summary, is_dismissed, archived_at)
		 VALUES (?, 'resolved', ?, '{}', ?, ?, ?, ?, 'Summary', 0, ?)`
	).run(
		id,
		severity,
		'2026-08-01T00:00:00.000Z',
		new Date().toISOString(),
		`https://example.com/${id}`,
		name,
		new Date().toISOString()
	);
};

const get = (url: string) => app.get(url).set('Authorization', `Bearer ${jwtToken}`);
const post = (url: string, body: object) => app.post(url).set('Authorization', `Bearer ${jwtToken}`).send(body);
const patch = (url: string, body: object) => app.patch(url).set('Authorization', `Bearer ${jwtToken}`).send(body);
const del = (url: string) => app.delete(url).set('Authorization', `Bearer ${jwtToken}`);

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
	insertAlert('inc-a', 'DB latency', 'warning', '2026-08-10T10:00:00.000Z');
	insertAlert('inc-b', 'DB errors', 'critical', '2026-08-10T09:00:00.000Z');
	insertAlert('inc-c', 'Disk full', 'info', '2026-08-10T11:00:00.000Z');
	insertAlert('inc-d', 'Unrelated', 'warning', '2026-08-10T12:00:00.000Z');
	insertResolvedAlert('inc-r', 'Old spike', 'critical');
});

describe('incidents', () => {
	let incidentId: number;

	test('creating from a selection groups the alerts and defaults the name', async () => {
		// A resolved alert can be a member too; the roll-up spans both tables.
		const res = await post('/api/v1/incidents', { alertIds: ['inc-a', 'inc-b', 'inc-r'] });
		expect(res.status).toBe(201);
		incidentId = res.body.data.id;
		expect(res.body.data.name).toBe(`Incident #${incidentId}`);
		expect(res.body.data.alertCount).toBe(3);
		expect(res.body.data.firingCount).toBe(2);
		expect(res.body.data.resolvedCount).toBe(1);
		expect(res.body.data.worstSeverity).toBe('critical');
		// Earliest member start, not creation time.
		expect(res.body.data.earliestStartsAt).toBe('2026-08-01T00:00:00.000Z');
		expect(res.body.data.alertIds.sort()).toEqual(['inc-a', 'inc-b', 'inc-r']);
		expect(res.body.data.ownerName).toBe('Provider User');
	});

	test('a member alert carries incidentId on the list response', async () => {
		const res = await get('/api/v1/alerts');
		expect(res.status).toBe(200);
		const byId = new Map(
			(res.body.data.alerts as { id: string; incidentId?: number | null }[]).map((a) => [a.id, a])
		);
		expect(byId.get('inc-a')?.incidentId).toBe(incidentId);
		expect(byId.get('inc-b')?.incidentId).toBe(incidentId);
		expect(byId.get('inc-d')?.incidentId ?? null).toBeNull();
	});

	test('membership is recorded on each member alert history', async () => {
		const res = await get('/api/v1/alerts/inc-a/history');
		expect(res.status).toBe(200);
		const events = res.body.data.data as { eventType?: string; description?: string }[];
		const added = events.find((e) => e.eventType === 'incident_added');
		expect(added).toBeTruthy();
		expect(added?.description).toContain(`Incident #${incidentId}`);
	});

	test('rename and description edit', async () => {
		const res = await patch(`/api/v1/incidents/${incidentId}`, {
			name: 'Database meltdown',
			description: 'Everything DB is on fire',
		});
		expect(res.status).toBe(200);
		expect(res.body.data.name).toBe('Database meltdown');
		const listed = await get('/api/v1/incidents');
		expect(listed.body.data[0].description).toBe('Everything DB is on fire');
	});

	test('creating a second incident with an already-grouped alert re-homes it', async () => {
		const res = await post('/api/v1/incidents', {
			name: 'Disk trouble',
			alertIds: ['inc-c', 'inc-a'],
		});
		expect(res.status).toBe(201);
		const second = res.body.data.id as number;
		const listed = await get('/api/v1/incidents');
		const byId = new Map(
			(listed.body.data as { id: number; alertIds: string[] }[]).map((i) => [i.id, i.alertIds.sort()])
		);
		expect(byId.get(second)).toEqual(['inc-a', 'inc-c']);
		// The first incident lost inc-a but keeps its other members.
		expect(byId.get(incidentId)).toEqual(['inc-b', 'inc-r']);
	});

	test('an incident can start from a single alert, but not from none', async () => {
		const one = await post('/api/v1/incidents', { name: 'Solo', alertIds: ['inc-d'] });
		expect(one.status).toBe(201);
		expect(one.body.data.alertCount).toBe(1);
		await del(`/api/v1/incidents/${one.body.data.id}`).expect(200);
		const none = await post('/api/v1/incidents', { alertIds: [] });
		expect(none.status).toBe(400);
	});

	test('removing the last members dissolves the incident', async () => {
		const res = await post(`/api/v1/incidents/${incidentId}/alerts/remove`, {
			alertIds: ['inc-b', 'inc-r'],
		});
		expect(res.status).toBe(200);
		expect(res.body.data.dissolved).toBe(true);
		const gone = await get(`/api/v1/incidents/${incidentId}`);
		expect(gone.status).toBe(404);
	});

	test('ungrouping deletes the incident but not the alerts', async () => {
		const created = await post('/api/v1/incidents', { alertIds: ['inc-a', 'inc-c'] });
		const id = created.body.data.id as number;
		const res = await del(`/api/v1/incidents/${id}`);
		expect(res.status).toBe(200);
		const alerts = await get('/api/v1/alerts');
		const byId = new Map(
			(alerts.body.data.alerts as { id: string; incidentId?: number | null }[]).map((a) => [a.id, a])
		);
		expect(byId.get('inc-a')).toBeTruthy();
		expect(byId.get('inc-a')?.incidentId ?? null).toBeNull();
	});

	test('unknown, duplicate and malformed inputs are rejected up front', async () => {
		const unknown = await post('/api/v1/incidents', { alertIds: ['inc-a', 'no-such-alert'] });
		expect(unknown.status).toBe(400);
		expect(unknown.body.error).toContain('no-such-alert');

		// Duplicate ids are rejected rather than silently collapsed.
		const dupes = await post('/api/v1/incidents', { alertIds: ['inc-a', 'inc-a'] });
		expect(dupes.status).toBe(400);

		// parseInt('12abc') is 12; the id param must be strictly digits.
		const sloppy = await get('/api/v1/incidents/12abc');
		expect(sloppy.status).toBe(400);
	});

	test('history records transitions, not requests', async () => {
		insertAlert('tr-a', 'Transit A', 'warning', '2026-08-11T10:00:00.000Z');
		insertAlert('tr-b', 'Transit B', 'warning', '2026-08-11T10:00:00.000Z');
		insertAlert('tr-c', 'Transit C', 'warning', '2026-08-11T10:00:00.000Z');
		await post('/api/v1/incidents', { name: 'First home', alertIds: ['tr-a', 'tr-b'] });

		const historyOf = async (alertId: string) => {
			const res = await get(`/api/v1/alerts/${alertId}/history`);
			return (res.body.data.data as { eventType?: string; description?: string }[]).filter((e) =>
				e.eventType?.startsWith('incident')
			);
		};

		// Re-homing writes a "removed from First home" AND an "added to Second".
		const second = await post('/api/v1/incidents', { name: 'Second home', alertIds: ['tr-a', 'tr-c'] });
		expect(second.status).toBe(201);
		const rehomed = await historyOf('tr-a');
		expect(rehomed).toHaveLength(3);
		const descriptions = rehomed.map((e) => `${e.eventType}: ${e.description}`);
		expect(descriptions).toContain('incident_removed: Removed from incident "First home"');
		expect(descriptions).toContain('incident_added: Grouped into incident "Second home"');

		// Removing a non-member records nothing.
		await post(`/api/v1/incidents/${second.body.data.id}/alerts/remove`, { alertIds: ['tr-b'] });
		expect(await historyOf('tr-b')).toHaveLength(1);
	});

	test('delete-forever of a member cleans its membership and dissolves an emptied incident', async () => {
		insertResolvedAlert('inc-r2', 'Old spike 2', 'warning');
		insertResolvedAlert('inc-r3', 'Old spike 3', 'warning');
		const created = await post('/api/v1/incidents', { alertIds: ['inc-r2', 'inc-r3'] });
		const id = created.body.data.id as number;

		await del('/api/v1/alerts/resolved/inc-r2').expect(200);
		let listed = await get('/api/v1/incidents');
		let summary = (listed.body.data as { id: number; alertCount: number }[]).find((i) => i.id === id);
		expect(summary?.alertCount).toBe(1);

		await del('/api/v1/alerts/resolved/inc-r3').expect(200);
		listed = await get('/api/v1/incidents');
		summary = (listed.body.data as { id: number; alertCount: number }[]).find((i) => i.id === id);
		expect(summary).toBeUndefined();
	});
});

describe('incident ownership', () => {
	let creatorId: number;
	let otherUserId: number;
	let incidentId: number;

	const alertsById = async () => {
		const res = await get('/api/v1/alerts');
		return new Map(
			(res.body.data.alerts as { id: string; ownerId?: string | null; incidentId?: number | null }[]).map((a) => [
				a.id,
				a,
			])
		);
	};

	beforeAll(() => {
		creatorId = (
			db.prepare(`SELECT id FROM users WHERE email = 'provideruser@example.com'`).get() as { id: number }
		).id;
		otherUserId = Number(
			db
				.prepare(
					`INSERT INTO users (email, password_hash, full_name, role) VALUES (?, 'x', 'Other User', 'viewer')`
				)
				.run('other@example.com').lastInsertRowid
		);
		insertAlert('own-a', 'Unowned A', 'warning', '2026-08-12T10:00:00.000Z');
		insertAlert('own-b', 'Owned B', 'warning', '2026-08-12T10:00:00.000Z');
		insertAlert('own-c', 'Unowned C', 'warning', '2026-08-12T10:00:00.000Z');
		db.prepare(`UPDATE alerts SET owner_id = ? WHERE id = 'own-b'`).run(otherUserId);
	});

	test('grouping makes the creator the owner of the incident and of its unowned members', async () => {
		const res = await post('/api/v1/incidents', { alertIds: ['own-a', 'own-b', 'own-c'] });
		expect(res.status).toBe(201);
		incidentId = res.body.data.id;
		expect(res.body.data.createdBy).toBe(creatorId);
		expect(res.body.data.ownerName).toBe('Provider User');

		const alerts = await alertsById();
		expect(alerts.get('own-a')?.ownerId).toBe(String(creatorId));
		expect(alerts.get('own-c')?.ownerId).toBe(String(creatorId));
		// An alert someone already owns keeps its owner.
		expect(alerts.get('own-b')?.ownerId).toBe(String(otherUserId));

		const history = await get('/api/v1/alerts/own-a/history');
		const types = (history.body.data.data as { eventType?: string }[]).map((e) => e.eventType);
		expect(types).toContain('owner_assigned');
	});

	test('removing an alert owner takes the alert out of its incident', async () => {
		const res = await patch('/api/v1/alerts/own-a/owner', { ownerId: null });
		expect(res.status).toBe(200);

		const alerts = await alertsById();
		expect(alerts.get('own-a')?.incidentId ?? null).toBeNull();
		expect(alerts.get('own-b')?.incidentId).toBe(incidentId);

		const incident = await get(`/api/v1/incidents/${incidentId}`);
		expect((incident.body.data.alertIds as string[]).sort()).toEqual(['own-b', 'own-c']);

		const history = await get('/api/v1/alerts/own-a/history');
		const types = (history.body.data.data as { eventType?: string }[]).map((e) => e.eventType);
		expect(types).toContain('incident_removed');
	});

	test('the bulk unassign path does the same, and the last member leaving dissolves the incident', async () => {
		const res = await post('/api/v1/alerts/bulk', {
			action: 'assignOwner',
			ownerId: null,
			ids: ['own-b', 'own-c'],
		});
		expect(res.status).toBe(200);
		const gone = await get(`/api/v1/incidents/${incidentId}`);
		expect(gone.status).toBe(404);
		expect((await alertsById()).get('own-b')?.incidentId ?? null).toBeNull();
	});

	test('adding alerts to an existing incident gives unowned ones the incident owner', async () => {
		insertAlert('add-a', 'Add A', 'warning', '2026-08-13T10:00:00.000Z');
		insertAlert('add-b', 'Add B', 'warning', '2026-08-13T10:00:00.000Z');
		insertAlert('add-c', 'Add C', 'warning', '2026-08-13T10:00:00.000Z');
		db.prepare(`UPDATE alerts SET owner_id = ? WHERE id = 'add-c'`).run(otherUserId);
		const created = await post('/api/v1/incidents', { name: 'Growing', alertIds: ['add-a', 'add-b'] });
		const id = created.body.data.id as number;

		// A resolved alert can join too; the roll-up spans both tables.
		const res = await post(`/api/v1/incidents/${id}/alerts`, { alertIds: ['add-c', 'inc-r'] });
		expect(res.status).toBe(200);
		expect(res.body.data.alertCount).toBe(4);
		expect(res.body.data.resolvedCount).toBe(1);
		const alerts = await alertsById();
		expect(alerts.get('add-c')?.incidentId).toBe(id);
		// Already owned: kept. inc-r was unowned (and resolved): it gets the incident owner.
		expect(alerts.get('add-c')?.ownerId).toBe(String(otherUserId));
		const resolved = await get('/api/v1/alerts/resolved');
		const r = (resolved.body.data.alerts as { id: string; ownerId?: string | null }[]).find(
			(a) => a.id === 'inc-r'
		);
		expect(r?.ownerId).toBe(String(creatorId));

		// Re-adding a member records no second "added" event.
		await post(`/api/v1/incidents/${id}/alerts`, { alertIds: ['add-a'] });
		const history = await get('/api/v1/alerts/add-a/history');
		const added = (history.body.data.data as { eventType?: string }[]).filter(
			(e) => e.eventType === 'incident_added'
		);
		expect(added).toHaveLength(1);

		const missing = await post(`/api/v1/incidents/${id}/alerts`, { alertIds: ['no-such'] });
		expect(missing.status).toBe(400);
		const gone = await post(`/api/v1/incidents/999999/alerts`, { alertIds: ['add-a'] });
		expect(gone.status).toBe(404);
	});

	test('a silenced member counts as silenced, not firing', async () => {
		insertAlert('sil-a', 'Sil A', 'warning', '2026-08-14T10:00:00.000Z');
		insertAlert('sil-b', 'Sil B', 'warning', '2026-08-14T10:00:00.000Z');
		const created = await post('/api/v1/incidents', { alertIds: ['sil-a', 'sil-b'] });
		const id = created.body.data.id as number;
		await patch('/api/v1/alerts/sil-a/silence', {}).expect(200);
		const res = await get(`/api/v1/incidents/${id}`);
		expect(res.body.data.alertCount).toBe(2);
		expect(res.body.data.firingCount).toBe(1);
		expect(res.body.data.silencedCount).toBe(1);
		expect(res.body.data.resolvedCount).toBe(0);
	});

	test('re-assigning to another owner keeps the alert in its incident', async () => {
		const res = await post('/api/v1/incidents', { alertIds: ['own-a', 'own-b'] });
		const id = res.body.data.id as number;
		await patch('/api/v1/alerts/own-a/owner', { ownerId: String(otherUserId) }).expect(200);
		const incident = await get(`/api/v1/incidents/${id}`);
		expect((incident.body.data.alertIds as string[]).sort()).toEqual(['own-a', 'own-b']);
	});
});

describe('incident lifecycle scenarios', () => {
	let creatorId: number;
	let incidentId: number;
	const alertsById = async () => {
		const res = await get('/api/v1/alerts');
		return new Map(
			(res.body.data.alerts as { id: string; ownerId?: string | null; incidentId?: number | null }[]).map((a) => [
				a.id,
				a,
			])
		);
	};
	interface Summary {
		alertCount: number;
		firingCount: number;
		silencedCount: number;
		resolvedCount: number;
		alertIds: string[];
	}
	const summary = async (): Promise<Summary> => (await get(`/api/v1/incidents/${incidentId}`)).body.data as Summary;

	beforeAll(async () => {
		creatorId = (
			db.prepare(`SELECT id FROM users WHERE email = 'provideruser@example.com'`).get() as { id: number }
		).id;
		insertAlert('life-a', 'Life A', 'warning', '2026-08-15T10:00:00.000Z');
		insertAlert('life-b', 'Life B', 'critical', '2026-08-15T10:00:00.000Z');
		const created = await post('/api/v1/incidents', { name: 'Lifecycle', alertIds: ['life-a', 'life-b'] });
		incidentId = created.body.data.id as number;
	});

	test('a member that resolves stays in the incident and counts as resolved', async () => {
		const res = await post('/api/v1/alerts/bulk', { action: 'resolve', ids: ['life-a'] });
		expect(res.status).toBe(200);
		const s = await summary();
		expect(s.alertCount).toBe(2);
		expect(s.firingCount).toBe(1);
		expect(s.resolvedCount).toBe(1);
		const resolved = await get('/api/v1/alerts/resolved');
		const r = (
			resolved.body.data.alerts as { id: string; incidentId?: number | null; ownerId?: string | null }[]
		).find((a) => a.id === 'life-a');
		expect(r?.incidentId).toBe(incidentId);
		expect(r?.ownerId).toBe(String(creatorId));
	});

	test('a resolved member that fires again is back in the incident, firing, with its owner', async () => {
		const res = await post('/api/v1/alerts/custom?api_token=opsimate', {
			id: 'life-a',
			alertName: 'Life A',
			severity: 'warning',
			summary: 'again',
			tags: {},
		});
		expect(res.status).toBe(200);
		const alerts = await alertsById();
		expect(alerts.get('life-a')?.incidentId).toBe(incidentId);
		expect(alerts.get('life-a')?.ownerId).toBe(String(creatorId));
		const s = await summary();
		expect(s.firingCount).toBe(2);
		expect(s.resolvedCount).toBe(0);
	});

	test('an incident whose members all resolved stays, reporting resolved', async () => {
		await post('/api/v1/alerts/bulk', { action: 'resolve', ids: ['life-a', 'life-b'] }).expect(200);
		const s = await summary();
		expect(s.alertCount).toBe(2);
		expect(s.firingCount).toBe(0);
		expect(s.silencedCount).toBe(0);
		expect(s.resolvedCount).toBe(2);
	});

	test('unresolving a member brings it back under the incident', async () => {
		await patch('/api/v1/alerts/resolved/life-b/unresolve', {}).expect(200);
		const alerts = await alertsById();
		expect(alerts.get('life-b')?.incidentId).toBe(incidentId);
		expect((await summary()).firingCount).toBe(1);
	});

	test('a retention-style raw purge of a member is cleaned up on the next read', async () => {
		db.prepare(`DELETE FROM alerts_resolved WHERE id = 'life-a'`).run();
		const s = await summary();
		expect(s.alertCount).toBe(1);
		expect(s.alertIds.sort()).toEqual(['life-b']);
	});
});
