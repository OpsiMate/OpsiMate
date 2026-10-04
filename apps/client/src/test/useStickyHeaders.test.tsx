import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useStickyHeaders } from '@/components/Alerts/AlertsTable/hooks/useStickyHeaders';
import { FlatGroupItem } from '@/components/Alerts/AlertsTable/AlertsTable.types';

type UseStickyHeadersInput = Parameters<typeof useStickyHeaders>[0];

const createGroup = (level: number, key: string): FlatGroupItem => ({
	type: 'group',
	key,
	field: `field${level}`,
	value: `value${level}`,
	count: 1,
	level,
	isExpanded: true,
	groupStatus: 'firing',
});

const createLeaf = (): FlatGroupItem => ({
	type: 'leaf',
	alert: {} as FlatGroupItem extends { type: 'leaf'; alert: infer A } ? A : never,
});

const createVirtualItem = (
	index: number,
	start: number,
	size: number
): UseStickyHeadersInput['virtualItems'][number] => ({
	index,
	start,
	size,
	key: index,
	lane: 0,
	end: start + size,
});

const createVirtualizer = (scrollOffset: number): UseStickyHeadersInput['virtualizer'] => ({
	scrollOffset,
});

describe('useStickyHeaders', () => {
	test('returns [] when there are no groupBy columns', () => {
		const { result } = renderHook(() =>
			useStickyHeaders({
				flatRows: [createGroup(0, 'group-0')],
				groupByColumns: [],
				virtualItems: [createVirtualItem(0, 0, 50)],
				virtualizer: createVirtualizer(0),
			})
		);

		expect(result.current).toEqual([]);
	});

	test('returns [] when there are no rows', () => {
		const { result } = renderHook(() =>
			useStickyHeaders({
				flatRows: [],
				groupByColumns: ['service'],
				virtualItems: [createVirtualItem(0, 0, 50)],
				virtualizer: createVirtualizer(0),
			})
		);

		expect(result.current).toEqual([]);
	});

	test('returns [] when there are no virtual items', () => {
		const { result } = renderHook(() =>
			useStickyHeaders({
				flatRows: [createGroup(0, 'group-0')],
				groupByColumns: ['service'],
				virtualItems: [],
				virtualizer: createVirtualizer(0),
			})
		);

		expect(result.current).toEqual([]);
	});

	test('collects one header for each level from the anchor and stops at level 0', () => {
		const flatRows = [
			createGroup(0, 'group-0'),
			createGroup(1, 'group-1'),
			createLeaf(),
			createGroup(2, 'group-2'),
			createLeaf(),
		];

		const { result } = renderHook(() =>
			useStickyHeaders({
				flatRows,
				groupByColumns: ['service', 'team', 'severity'],
				virtualItems: [createVirtualItem(4, 100, 50)],
				virtualizer: createVirtualizer(100),
			})
		);

		expect(result.current).toEqual([flatRows[0], flatRows[1], flatRows[3]]);
	});

	test('returns headers sorted by level', () => {
		const flatRows = [createGroup(0, 'group-0'), createGroup(2, 'group-2'), createGroup(1, 'group-1')];

		const { result } = renderHook(() =>
			useStickyHeaders({
				flatRows,
				groupByColumns: ['service', 'team', 'severity'],
				virtualItems: [createVirtualItem(2, 100, 50)],
				virtualizer: createVirtualizer(100),
			})
		);

		expect(result.current.map((item) => (item.type === 'group' ? item.level : -1))).toEqual([0, 1, 2]);
	});

	test('uses the first virtual item when no item passes the scroll offset', () => {
		const flatRows = [createGroup(0, 'group-0'), createGroup(1, 'group-1')];

		const virtualItems = [createVirtualItem(0, 0, 20), createVirtualItem(1, 20, 20)];

		const { result } = renderHook(() =>
			useStickyHeaders({
				flatRows,
				groupByColumns: ['service'],
				virtualItems,
				virtualizer: createVirtualizer(100),
			})
		);

		expect(result.current).toEqual([flatRows[0]]);
	});
});
