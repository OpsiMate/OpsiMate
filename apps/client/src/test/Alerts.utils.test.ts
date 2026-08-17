import { AlertGroupSummaryNode } from '@OpsiMate/shared';
import { describe, expect, test } from 'vitest';
import { diffAddedFilters, splitOwnerPaneCounts } from '@/components/Alerts/Alerts.utils';

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
		expect(diffAddedFilters(saved, saved)).toEqual([]);
	});

	test('only values added on top of the saved ones are reported', () => {
		const added = diffAddedFilters(
			{ severity: ['Critical', 'Warning'], 'tagKey:env': ['prod'] },
			{ severity: ['Critical'], 'tagKey:env': ['prod'] }
		);
		expect(added).toEqual([{ key: 'severity', field: 'severity', value: 'Warning', excluded: false }]);
	});

	test('a fresh draft with no saved filters reports every active filter', () => {
		const added = diffAddedFilters({ severity: ['Critical'], owner: ['Unassigned'] }, {});
		expect(added.map((a) => a.value)).toEqual(['Critical', 'Unassigned']);
	});

	test('exclusions are reported and flagged, with the bare field for labelling', () => {
		const added = diffAddedFilters({ '!status': ['Silenced'] }, {});
		expect(added).toEqual([{ key: '!status', field: 'status', value: 'Silenced', excluded: true }]);
	});

	test('removing a saved filter is not an addition', () => {
		expect(diffAddedFilters({ severity: [] }, { severity: ['Critical'] })).toEqual([]);
	});

	test('undefined on either side is handled', () => {
		expect(diffAddedFilters(undefined, undefined)).toEqual([]);
		expect(diffAddedFilters({ severity: ['Critical'] }, undefined)).toHaveLength(1);
	});
});
