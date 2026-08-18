import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useTableSort } from '@/components/shared/SortableTable';

interface Row {
	name: string;
	priority: number;
	endsAt: string | null;
}

const rows: Row[] = [
	{ name: 'beta', priority: 2, endsAt: '2026-03-01T00:00:00Z' },
	{ name: 'Alpha', priority: 10, endsAt: null },
	{ name: 'policy 10', priority: 1, endsAt: '2026-01-01T00:00:00Z' },
	{ name: 'policy 2', priority: 1, endsAt: '2026-02-01T00:00:00Z' },
];

const accessors = {
	name: (r: Row) => r.name,
	priority: (r: Row) => r.priority,
	window: (r: Row) => (r.endsAt ? new Date(r.endsAt).getTime() : null),
};

const setup = (initial?: Parameters<typeof useTableSort<Row, keyof typeof accessors>>[2]) =>
	renderHook(() => useTableSort(rows, accessors, initial));

describe('useTableSort', () => {
	test('unsorted keeps the list order', () => {
		const { result } = setup();
		expect(result.current.sorted.map((r) => r.name)).toEqual(['beta', 'Alpha', 'policy 10', 'policy 2']);
	});

	test('first click sorts ascending, second reverses', () => {
		const { result } = setup();
		act(() => result.current.toggle('priority'));
		expect(result.current.sorted.map((r) => r.priority)).toEqual([1, 1, 2, 10]);
		act(() => result.current.toggle('priority'));
		expect(result.current.direction).toBe('desc');
		expect(result.current.sorted.map((r) => r.priority)).toEqual([10, 2, 1, 1]);
	});

	test('switching column starts ascending again rather than inheriting the direction', () => {
		const { result } = setup();
		act(() => result.current.toggle('priority'));
		act(() => result.current.toggle('priority'));
		expect(result.current.direction).toBe('desc');
		act(() => result.current.toggle('name'));
		expect(result.current.direction).toBe('asc');
	});

	test('names sort case-insensitively and numerically, not by char code', () => {
		const { result } = setup();
		act(() => result.current.toggle('name'));
		// 'Alpha' before 'beta' (case-insensitive), and 'policy 2' before 'policy 10'.
		expect(result.current.sorted.map((r) => r.name)).toEqual(['Alpha', 'beta', 'policy 2', 'policy 10']);
	});

	test('missing values park at the end in BOTH directions', () => {
		const { result } = setup();
		act(() => result.current.toggle('window'));
		expect(result.current.sorted[result.current.sorted.length - 1]?.name).toBe('Alpha');
		act(() => result.current.toggle('window'));
		expect(result.current.direction).toBe('desc');
		// Still last: "no end date" is absence, not a small value.
		expect(result.current.sorted[result.current.sorted.length - 1]?.name).toBe('Alpha');
	});

	test('an initial key sorts on first render without a click', () => {
		const { result } = setup({ initialKey: 'priority', initialDirection: 'desc' });
		expect(result.current.sorted.map((r) => r.priority)).toEqual([10, 2, 1, 1]);
	});

	test('sorting never mutates the caller list', () => {
		const original = [...rows];
		const { result } = setup();
		act(() => result.current.toggle('name'));
		expect(rows).toEqual(original);
	});
});
