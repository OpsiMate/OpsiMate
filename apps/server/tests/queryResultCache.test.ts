import { beforeAll, describe, expect, test } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { Alert, AlertOwnerInfo, compareAlerts, sortAlertsBy } from '@OpsiMate/shared';
import { QueryResultCache, stableQueryKey } from '../src/bl/alerts/queryResultCache';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// The per-query result cache (pages/facets/groups over a snapshot) and the
// decorate-sort-undecorate rewrite of sortAlertsBy. The cache is content-addressed on
// snapshot etags, so the property that matters most — a mutation is visible to the
// query that immediately follows it — is proven over HTTP with caching actually on.

describe('QueryResultCache', () => {
	test('evicts the least recently used entry at capacity', () => {
		const cache = new QueryResultCache<number>(2);
		cache.set('a', 1);
		cache.set('b', 2);
		// Touch 'a' so 'b' is now the oldest.
		expect(cache.get('a')).toBe(1);
		cache.set('c', 3);
		expect(cache.get('b')).toBeUndefined();
		expect(cache.get('a')).toBe(1);
		expect(cache.get('c')).toBe(3);
	});

	test('overwriting a key does not grow the cache', () => {
		const cache = new QueryResultCache<number>(2);
		cache.set('a', 1);
		cache.set('a', 2);
		cache.set('b', 3);
		expect(cache.get('a')).toBe(2);
		expect(cache.get('b')).toBe(3);
	});
});

describe('stableQueryKey', () => {
	test('is insensitive to object property order, recursively', () => {
		expect(stableQueryKey({ b: 1, a: { d: 2, c: 3 } })).toBe(stableQueryKey({ a: { c: 3, d: 2 }, b: 1 }));
	});

	test('array order is significant', () => {
		expect(stableQueryKey({ tags: ['a', 'b'] })).not.toBe(stableQueryKey({ tags: ['b', 'a'] }));
	});

	test('an absent key and an undefined key produce the same key', () => {
		expect(stableQueryKey({ a: 1, b: undefined })).toBe(stableQueryKey({ a: 1 }));
	});

	test('scalars and null are distinguished', () => {
		expect(stableQueryKey({ a: null })).not.toBe(stableQueryKey({ a: 'null' }));
		expect(stableQueryKey({ a: 1 })).not.toBe(stableQueryKey({ a: '1' }));
	});
});

describe('sortAlertsBy matches compareAlerts ordering exactly', () => {
	const mkAlert = (id: string, overrides: Partial<Alert> = {}): Alert =>
		({
			id,
			type: 'Grafana',
			status: 'firing',
			tags: {},
			startsAt: new Date(2026, 0, 1, 12, 0, 0).toISOString(),
			updatedAt: new Date(2026, 0, 2, 12, 0, 0).toISOString(),
			alertUrl: `https://example.com/${id}`,
			alertName: `Alert ${id}`,
			isSilenced: false,
			isMuted: false,
			...overrides,
		}) as Alert;

	const owners: AlertOwnerInfo[] = [
		{ id: '1', fullName: 'Zoe' },
		{ id: '2', fullName: 'Ari' },
	];
	// Duplicated names/severities force tiebreaks; unparseable dates force the 0
	// fallback; a missing owner forces the null/absent key path.
	const alerts: Alert[] = [
		mkAlert('e', { alertName: 'Same', severity: 'critical', ownerId: '1' }),
		mkAlert('a', { alertName: 'Same', severity: 'warning', startsAt: 'not-a-date' }),
		mkAlert('d', { alertName: 'zeta', severity: 'critical', ownerId: '2' }),
		mkAlert('b', { alertName: 'Alpha', severity: 'info', ownerId: '9' }),
		mkAlert('c', { alertName: 'alpha', severity: undefined as unknown as string }),
	];

	const fields = ['alertName', 'severity', 'startsAt', 'updatedAt', 'owner', 'status', 'type', 'no-such-field'];

	for (const field of fields) {
		for (const dir of ['asc', 'desc'] as const) {
			test(`${field} ${dir}`, () => {
				const viaComparator = [...alerts]
					.sort((x, y) => compareAlerts(x, y, field, dir, owners))
					.map((alert) => alert.id);
				const viaDecorated = sortAlertsBy(alerts, field, dir, owners).map((alert) => alert.id);
				expect(viaDecorated).toEqual(viaComparator);
			});
		}
	}

	test('does not mutate its input', () => {
		const input = [...alerts];
		sortAlertsBy(input, 'alertName', 'asc', owners);
		expect(input.map((a) => a.id)).toEqual(alerts.map((a) => a.id));
	});
});

// HTTP layer with caching ON (TTL opted-in like alertsSnapshotCache.test.ts): repeat
// queries serve the cached result, and an API mutation is visible to the very next
// query — the guard against a bad cache key silently pinning stale pages.
describe('query result cache over HTTP', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let jwtToken: string;

	const insertAlert = (id: string, name: string) => {
		db.prepare(
			`INSERT INTO alerts (id, status, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url, is_dismissed)
			 VALUES (?, 'firing', '{}', ?, ?, ?, ?, 'Summary', NULL, 0)`
		).run(id, new Date().toISOString(), new Date().toISOString(), `https://example.com/${id}`, name);
	};

	interface ResponseAlert {
		id: string;
		isSilenced?: boolean;
	}

	const query = () =>
		app.get('/api/v1/alerts?limit=10&sort=alertName&dir=asc').set('Authorization', `Bearer ${jwtToken}`);

	beforeAll(async () => {
		process.env.ALERTS_SNAPSHOT_TTL_MS = '60000';
		db = await setupDB();
		app = await setupExpressApp(db);
		jwtToken = await setupUserWithToken(app);
		process.env.ALERTS_SNAPSHOT_TTL_MS = '0';
		insertAlert('qc-1', 'Query Cache 1');
		insertAlert('qc-2', 'Query Cache 2');
	});

	test('a repeated identical query returns the identical page and ETag', async () => {
		const first = await query();
		expect(first.status).toBe(200);
		const second = await query();
		expect(second.status).toBe(200);
		expect(second.headers['etag']).toBe(first.headers['etag']);
		expect(second.body).toEqual(first.body);
	});

	test('a mutation through the API is visible to the immediately following query', async () => {
		const before = await query();
		const silence = await app
			.patch('/api/v1/alerts/qc-1/silence')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({});
		expect(silence.status).toBe(200);

		const after = await query();
		const silenced = after.body.data.alerts.find((a: ResponseAlert) => a.id === 'qc-1');
		expect(silenced.isSilenced).toBe(true);
		expect(after.headers['etag']).not.toBe(before.headers['etag']);
	});

	test('facets reflect a mutation immediately as well', async () => {
		const before = await app.get('/api/v1/alerts/facets').set('Authorization', `Bearer ${jwtToken}`);
		expect(before.status).toBe(200);
		const silence = await app
			.patch('/api/v1/alerts/qc-2/silence')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({});
		expect(silence.status).toBe(200);
		const after = await app.get('/api/v1/alerts/facets').set('Authorization', `Bearer ${jwtToken}`);
		expect(after.status).toBe(200);
		expect(after.body).not.toEqual(before.body);
	});
});
