import { AlertGroupSummaryNode } from '@OpsiMate/shared';
import { describe, expect, test } from 'vitest';
import { diffFilterChanges, splitOwnerPaneCounts } from '@/components/Alerts/Alerts.utils';

const node = (value: string, count: number): AlertGroupSummaryNode =>
	({
		key: `owner:${value}`,
		field: 'owner',
		value,
		count,
		status: 'firing',
		level: 0,
		children: [],
	}) as unknown as AlertGroupSummaryNode;

describe('splitOwnerPaneCounts', () => {
	test('splits the Unassigned bucket from every named owner', () => {
		const counts = splitOwnerPaneCounts([node('Unassigned', 42), node('John Doe', 3), node('Dana', 2)]);
		expect(counts).toEqual({ unassigned: 42, assigned: 5 });
	});

	test('all unassigned: assigned is zero, and the two sum to the whole response', () => {
		const counts = splitOwnerPaneCounts([node('Unassigned', 41)]);
		expect(counts).toEqual({ unassigned: 41, assigned: 0 });
	});

	test('no summaries yet returns undefined so headers fall back to loaded counts', () => {
		expect(splitOwnerPaneCounts(undefined)).toBeUndefined();
	});

	test('empty response is a real zero, not a fallback', () => {
		expect(splitOwnerPaneCounts([])).toEqual({ unassigned: 0, assigned: 0 });
	});
});

describe('diffAddedFilters', () => {
	test('a dashboard opened with saved filters announces nothing', () => {
		const saved = { severity: ['Critical'], 'tagKey:env': ['prod'] };
		expect(diffFilterChanges(saved, saved)).toEqual([]);
	});

	test('only values added on top of the saved ones are reported', () => {
		const added = diffFilterChanges(
			{ severity: ['Critical', 'Warning'], 'tagKey:env': ['prod'] },
			{ severity: ['Critical'], 'tagKey:env': ['prod'] }
		);
		expect(added).toEqual([
			{ key: 'severity', field: 'severity', value: 'Warning', excluded: false, direction: 'added' },
		]);
	});

	test('a fresh draft with no saved filters reports every active filter', () => {
		const added = diffFilterChanges({ severity: ['Critical'], owner: ['Unassigned'] }, {});
		expect(added.map((a) => a.value)).toEqual(['Critical', 'Unassigned']);
	});

	test('exclusions are reported and flagged, with the bare field for labelling', () => {
		const added = diffFilterChanges({ '!status': ['Silenced'] }, {});
		expect(added).toEqual([
			{ key: '!status', field: 'status', value: 'Silenced', excluded: true, direction: 'added' },
		]);
	});

	test('removing a filter the dashboard was saved with is reported as a removal', () => {
		expect(diffFilterChanges({ severity: [] }, { severity: ['Critical'] })).toEqual([
			{ key: 'severity', field: 'severity', value: 'Critical', excluded: false, direction: 'removed' },
		]);
	});

	test('dropping the whole key still counts as a removal', () => {
		expect(diffFilterChanges({}, { severity: ['Critical'] }).map((c) => c.direction)).toEqual(['removed']);
	});

	test('additions and removals are reported together', () => {
		const changes = diffFilterChanges({ severity: ['Warning'] }, { severity: ['Critical'] });
		expect(changes.map((c) => `${c.direction}:${c.value}`)).toEqual(['added:Warning', 'removed:Critical']);
	});

	test('undefined on either side is handled', () => {
		expect(diffFilterChanges(undefined, undefined)).toEqual([]);
		expect(diffFilterChanges({ severity: ['Critical'] }, undefined)).toHaveLength(1);
	});
});

// The notice must describe only what is actually narrowing the CURRENT tab. Resolved
// and All run with the status filter suspended, so a status value picked there isn't
// filtering anything and must not be announced (nor silently undone).
describe('diffAddedFilters on suspended-status tabs', () => {
	const suspend = (filters: Record<string, string[]>) => {
		const { status: _s, ['!status']: _n, ...rest } = filters;
		return rest;
	};

	test('an added status filter is announced on the Active tab', () => {
		const added = diffFilterChanges({ status: ['Firing'] }, {});
		expect(added).toHaveLength(1);
	});

	test('the same filter is silent once status is suspended', () => {
		const added = diffFilterChanges(suspend({ status: ['Firing'] }), {});
		expect(added).toEqual([]);
	});

	test('non-status additions still surface on a suspended tab', () => {
		const added = diffFilterChanges(suspend({ status: ['Firing'], severity: ['Critical'] }), {});
		expect(added.map((a) => a.field)).toEqual(['severity']);
	});
});
