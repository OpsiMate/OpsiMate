import { AlertGroupSummaryNode } from '@OpsiMate/shared';
import { describe, expect, test } from 'vitest';
import { splitOwnerPaneCounts } from '@/components/Alerts/Alerts.utils';

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
