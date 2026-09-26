import { describe, expect, test } from 'vitest';
import {
	Alert,
	AlertListQuery,
	AlertOwnerInfo,
	applyAlertListQuery,
	alertMatchesFilters,
	applyTimeWindow,
	computeAlertFacets,
	getAlertFilterFieldValue,
	getAlertTagsString,
	getIntegrationLabel,
	resolveAlertIntegration,
	sortAlertsBy,
	collectAlertTagKeys,
	getTagKeyColumnId,
} from '@OpsiMate/shared';

// The query engine memoizes per alert object and per list array (search text, filter
// columns, sorted order, tag keys). These tests pin the contract: the memoized engine
// returns exactly what a from-scratch computation returns, for any query, and a
// changed alert (a new object) or a changed list (a new array) is reflected.

const BASE_FACET_FIELDS = ['status', 'severity', 'type', 'alertName', 'owner'];

// From-scratch reference of the pre-memo engine.
const referenceSearch = (alerts: Alert[], term: string): Alert[] => {
	const lower = term.trim().toLowerCase();
	if (!lower) return alerts;
	return alerts.filter(
		(a) =>
			(a.alertName && a.alertName.toLowerCase().includes(lower)) ||
			(a.status && a.status.toLowerCase().includes(lower)) ||
			getAlertTagsString(a).toLowerCase().includes(lower) ||
			(a.summary && a.summary.toLowerCase().includes(lower)) ||
			(a.lastComment && a.lastComment.toLowerCase().includes(lower)) ||
			getIntegrationLabel(resolveAlertIntegration(a)).toLowerCase().includes(lower)
	);
};
const referenceQuery = (alerts: Alert[], users: AlertOwnerInfo[], q: AlertListQuery) => {
	let r = applyTimeWindow(alerts, { from: q.from ?? null, to: q.to ?? null });
	if (q.filters && Object.keys(q.filters).length) r = r.filter((a) => alertMatchesFilters(a, q.filters!, users));
	if (q.search) r = referenceSearch(r, q.search);
	r = sortAlertsBy(r, q.sort ?? 'startsAt', q.dir ?? 'desc', users);
	return r;
};
const referenceFacets = (alerts: Alert[], filters: Record<string, string[]>, users: AlertOwnerInfo[]) => {
	const tagKeys = collectAlertTagKeys(alerts);
	const fields = [...BASE_FACET_FIELDS, ...tagKeys.map((tk) => getTagKeyColumnId(tk.key))];
	const facets: Record<string, Record<string, number>> = {};
	for (const field of fields) {
		const counts: Record<string, number> = {};
		for (const a of alerts) {
			const others = Object.fromEntries(Object.entries(filters).filter(([k]) => k.replace(/^!/, '') !== field));
			if (!alertMatchesFilters(a, others, users)) continue;
			const v = getAlertFilterFieldValue(a, field, users);
			if (v === null || v === '') continue;
			counts[v] = (counts[v] ?? 0) + 1;
		}
		facets[field] = counts;
	}
	return facets;
};

// Deterministic pseudo-random alerts with overlapping names, tags, owners, silences.
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const makeAlert = (i: number): Alert => {
	const day = 1 + Math.floor(rnd() * 20);
	return {
		id: `a-${i}`,
		type: pick(['Custom', 'grafana', 'datadog']),
		status: 'firing',
		severity: pick(['critical', 'warning', 'info']) as Alert['severity'],
		tags: {
			env: pick(['prod', 'staging', '']),
			team: pick(['core', 'edge']),
			...(rnd() < 0.3 ? { svc: pick(['api', 'db']) } : {}),
		},
		startsAt: `2026-09-${String(day).padStart(2, '0')}T10:00:00.000Z`,
		updatedAt: `2026-09-${String(day).padStart(2, '0')}T12:00:00.000Z`,
		alertUrl: '',
		alertName: `${pick(['Disk full', 'CPU high', 'Latency p99', 'queue lag'])} ${pick(['node', 'pod', 'vm'])} ${i % 7}`,
		summary: rnd() < 0.5 ? `summary ${pick(['kafka', 'redis', 'nginx'])}` : null,
		lastComment: rnd() < 0.2 ? `note ${pick(['ack', 'wip'])}` : null,
		isSilenced: rnd() < 0.15,
		isMuted: rnd() < 0.1,
		isRead: false,
		ownerId: rnd() < 0.4 ? pick(['1', '2']) : null,
		createdAt: '2026-09-01 00:00:00',
		// Re-fired alerts: a later firing inside a window must become that window's startsAt.
		...(rnd() < 0.3
			? {
					firingTimes: [
						`2026-09-${String(day).padStart(2, '0')}T10:00:00.000Z`,
						`2026-09-${String(Math.min(28, day + 6)).padStart(2, '0')}T09:00:00.000Z`,
					],
				}
			: {}),
	} as Alert;
};
const users: AlertOwnerInfo[] = [
	{ id: '1', fullName: 'Alice' },
	{ id: '2', fullName: 'bob' },
] as AlertOwnerInfo[];
const alerts = Array.from({ length: 400 }, (_, i) => makeAlert(i));

const queries: AlertListQuery[] = [
	{},
	{ search: 'disk' },
	{ search: 'NODE 3' },
	{ search: 'kafka' },
	{ search: 'ack' },
	{ search: 'grafana' },
	{ search: 'silenced' },
	{ filters: { severity: ['Critical'] } },
	{ filters: { '!severity': ['Info'], 'tagKey:env': ['prod'] } },
	{ filters: { status: ['Silenced'] } },
	{ filters: { owner: ['Alice'] }, sort: 'owner', dir: 'asc' },
	{ filters: { 'tagKey:svc': ['api'] }, search: 'pod' },
	{ search: 'cpu', sort: 'alertName', dir: 'asc' },
	{ sort: 'severity', dir: 'desc' },
	{ sort: 'tagKey:team', dir: 'asc' },
	{ from: '2026-09-05T00:00:00.000Z', to: '2026-09-12T00:00:00.000Z' },
	{ from: '2026-09-10T00:00:00.000Z', search: 'vm', filters: { severity: ['Warning', 'Critical'] } },
	{ to: '2026-09-15T00:00:00.000Z', sort: 'startsAt', dir: 'asc' },
	{ from: '2026-09-03T00:00:00.000Z', to: '2026-09-20T00:00:00.000Z', sort: 'updatedAt', dir: 'desc', limit: 20 },
];
const ids = (xs: Alert[]) => xs.map((a) => a.id);

describe('memoized query engine equals a from-scratch computation', () => {
	test.each(queries.map((q) => [JSON.stringify(q), q] as const))('query %s', (_label, q) => {
		const expected = referenceQuery(alerts, users, q);
		const limited = q.limit ? expected.slice(0, q.limit) : expected;
		// Twice: the second call is served from the memos. Whole items, not just ids: a
		// time window rewrites startsAt to the episode inside it.
		expect(applyAlertListQuery(alerts, users, q).items).toEqual(limited);
		expect(applyAlertListQuery(alerts, users, q).items).toEqual(limited);
	});

	test('a time window rewrites startsAt to the latest firing inside it, and sorts by that', () => {
		const q: AlertListQuery = {
			from: '2026-09-05T00:00:00.000Z',
			to: '2026-09-25T00:00:00.000Z',
			sort: 'startsAt',
			dir: 'desc',
		};
		const items = applyAlertListQuery(alerts, users, q).items;
		const rewritten = items.filter(
			(a) => a.firingTimes && a.startsAt !== alerts.find((o) => o.id === a.id)?.startsAt
		);
		expect(rewritten.length).toBeGreaterThan(0);
		for (const a of rewritten) expect(a.firingTimes).toContain(a.startsAt);
		expect(items.map((a) => a.id)).toEqual(referenceQuery(alerts, users, q).map((a) => a.id));
	});

	test('paging with a cursor walks the same order', () => {
		const q: AlertListQuery = { search: 'node', sort: 'alertName', dir: 'asc' };
		const expected = ids(referenceQuery(alerts, users, q));
		const walked: string[] = [];
		let cursor: string | undefined;
		for (;;) {
			const page = applyAlertListQuery(alerts, users, { ...q, limit: 7, cursor });
			walked.push(...ids(page.items));
			if (!page.nextCursor) break;
			cursor = page.nextCursor;
		}
		expect(walked).toEqual(expected);
	});

	test.each([
		{},
		{ severity: ['Critical'] },
		{ '!severity': ['Info'], 'tagKey:env': ['prod'] },
		{ status: ['Silenced'], owner: ['bob'] },
	])('facets with filters %o', (filters) => {
		const expected = referenceFacets(alerts, filters, users);
		expect(computeAlertFacets(alerts, filters, undefined, users).facets).toEqual(expected);
		expect(computeAlertFacets(alerts, filters, undefined, users).facets).toEqual(expected);
	});
});

describe('memos follow identity', () => {
	test('a changed alert (new object) is searched and counted by its new content', () => {
		const before = applyAlertListQuery(alerts, users, { search: 'zzz-unique' });
		expect(before.total).toBe(0);
		const changed = alerts.map((a, i) => (i === 5 ? { ...a, alertName: 'zzz-unique thing' } : a));
		const after = applyAlertListQuery(changed, users, { search: 'zzz-unique' });
		expect(ids(after.items)).toEqual(['a-5']);
		expect(computeAlertFacets(changed, {}, ['alertName'], users).facets.alertName['zzz-unique thing']).toBe(1);
	});

	test('a shorter list (new array) drops the removed alerts from every path', () => {
		const fewer = alerts.filter((a) => a.id !== 'a-1');
		expect(ids(applyAlertListQuery(fewer, users, { sort: 'alertName', dir: 'asc' }).items)).not.toContain('a-1');
		expect(computeAlertFacets(fewer, {}, undefined, users).total).toBe(alerts.length - 1);
	});

	test('a renamed owner (new users list) changes owner filters, facets and sort', () => {
		const renamed: AlertOwnerInfo[] = [{ id: '1', fullName: 'Zed' }, users[1]] as AlertOwnerInfo[];
		const byOld = applyAlertListQuery(alerts, users, { filters: { owner: ['Alice'] } }).total;
		expect(byOld).toBeGreaterThan(0);
		expect(applyAlertListQuery(alerts, renamed, { filters: { owner: ['Alice'] } }).total).toBe(0);
		expect(applyAlertListQuery(alerts, renamed, { filters: { owner: ['Zed'] } }).total).toBe(byOld);
		expect(computeAlertFacets(alerts, {}, ['owner'], renamed).facets.owner.Zed).toBe(byOld);
		const sorted = applyAlertListQuery(alerts, renamed, {
			sort: 'owner',
			dir: 'asc',
			filters: { owner: ['Zed', 'bob'] },
		}).items;
		expect(sorted[0].ownerId).toBe('2'); // bob before Zed
	});

	test('the input array is not mutated by sorting', () => {
		const copy = alerts.slice();
		applyAlertListQuery(alerts, users, { sort: 'alertName', dir: 'asc' });
		expect(alerts).toEqual(copy);
	});
});
