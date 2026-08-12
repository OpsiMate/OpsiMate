import { describe, expect, test } from 'vitest';
import { Alert, AlertStatus, applyAlertListQuery, computeAlertFacets, getTagKeyColumnId } from '@OpsiMate/shared';

// The engine's own behaviors: paging, cursors, facet semantics. Filter/sort/search
// semantics themselves are pinned by the client's test suite over the same functions.

const mkAlert = (id: string, overrides: Partial<Alert> = {}): Alert =>
	({
		id,
		type: 'Grafana',
		status: AlertStatus.FIRING,
		tags: {},
		startsAt: new Date(2026, 0, 1, 12, 0, 0).toISOString(),
		updatedAt: new Date(2026, 0, 2, 12, 0, 0).toISOString(),
		alertUrl: `https://example.com/${id}`,
		alertName: `Alert ${id}`,
		isSilenced: false,
		isMuted: false,
		...overrides,
	}) as Alert;

// Each alert's [startsAt, updatedAt] spans one day, staggered a day apart.
const spanning = (id: string, startDay: number, overrides: Partial<Alert> = {}) =>
	mkAlert(id, {
		startsAt: new Date(2026, 0, startDay).toISOString(),
		updatedAt: new Date(2026, 0, startDay + 1).toISOString(),
		...overrides,
	});

const alerts = [
	spanning('a', 5, { tags: { env: 'prod' } }),
	spanning('b', 4, { tags: { env: 'prod' } }),
	spanning('c', 3, { tags: { env: 'staging' } }),
	spanning('d', 2, { tags: { env: 'staging' }, isSilenced: true }),
	spanning('e', 1, { tags: { env: 'dev' } }),
];

describe('applyAlertListQuery paging', () => {
	test('no limit returns everything, sorted, with no cursor', () => {
		const page = applyAlertListQuery(alerts, [], {});
		expect(page.items.map((a) => a.id)).toEqual(['a', 'b', 'c', 'd', 'e']); // startsAt desc default
		expect(page.total).toBe(5);
		expect(page.nextCursor).toBeNull();
	});

	test('limit slices and hands back a cursor; the next page continues exactly', () => {
		const first = applyAlertListQuery(alerts, [], { limit: 2 });
		expect(first.items.map((a) => a.id)).toEqual(['a', 'b']);
		expect(first.total).toBe(5);
		expect(first.nextCursor).toBe('b');

		const second = applyAlertListQuery(alerts, [], { limit: 2, cursor: first.nextCursor! });
		expect(second.items.map((a) => a.id)).toEqual(['c', 'd']);

		const third = applyAlertListQuery(alerts, [], { limit: 2, cursor: second.nextCursor! });
		expect(third.items.map((a) => a.id)).toEqual(['e']);
		expect(third.nextCursor).toBeNull();
	});

	test('a row disappearing between pages neither duplicates nor restarts the scroll', () => {
		const first = applyAlertListQuery(alerts, [], { limit: 2 });
		expect(first.nextCursor).toBe('b');
		// 'b' resolves away before the next page is requested.
		const remaining = alerts.filter((a) => a.id !== 'b');
		const second = applyAlertListQuery(remaining, [], { limit: 2, cursor: 'b' });
		expect(second.items.map((a) => a.id)).toEqual(['c', 'd']);
	});

	test('filters and search constrain before paging, and total reflects the filtered count', () => {
		const page = applyAlertListQuery(alerts, [], {
			filters: { [getTagKeyColumnId('env')]: ['prod', 'staging'] },
			limit: 3,
		});
		expect(page.total).toBe(4);
		expect(page.items.map((a) => a.id)).toEqual(['a', 'b', 'c']);
	});

	test('a concrete time window filters by overlap, boundaries inclusive', () => {
		const page = applyAlertListQuery(alerts, [], {
			from: new Date(2026, 0, 4).toISOString(),
			to: new Date(2026, 0, 6).toISOString(),
		});
		// a [5,6] and b [4,5] sit inside; c [3,4] touches the window's start exactly and
		// overlap is inclusive; d and e end before it opens.
		expect(page.items.map((a) => a.id).sort()).toEqual(['a', 'b', 'c']);
	});
});

describe('computeAlertFacets', () => {
	test('counts values with faceted semantics: a field is not constrained by itself', () => {
		const envField = getTagKeyColumnId('env');
		const { facets } = computeAlertFacets(alerts, { [envField]: ['prod'] }, [envField, 'status'], []);
		// env facet ignores its own filter: all three values visible with full counts.
		expect(facets[envField]).toEqual({ prod: 2, staging: 2, dev: 1 });
		// status facet IS constrained by the env filter: only prod alerts count.
		expect(facets['status']).toEqual({ Firing: 2 });
	});

	test('exclusion filters constrain other facets', () => {
		const envField = getTagKeyColumnId('env');
		const { facets } = computeAlertFacets(alerts, { ['!' + envField]: ['prod'] }, ['status'], []);
		expect(facets['status']).toEqual({ Firing: 2, Silenced: 1 });
	});

	test('reports raw totals alongside', () => {
		const result = computeAlertFacets(alerts, {}, ['status'], []);
		expect(result.total).toBe(5);
		expect(result.silencedTotal).toBe(1);
	});
});
