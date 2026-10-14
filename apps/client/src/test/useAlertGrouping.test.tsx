import { act, renderHook } from '@testing-library/react';
import { Alert, AlertStatus } from '@OpsiMate/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useAlertGrouping } from '@/components/Alerts/AlertsTable/hooks/useAlertGrouping';
import { ALERTS_GROUP_BY_STORAGE_KEY } from '@/components/Alerts/AlertsTable/hooks/useAlertGrouping.constants';
import { FlatGroupItem } from '@/components/Alerts/AlertsTable/AlertsTable.types';

// groupAlerts / flattenGroups are covered by alertGrouping.test.ts; what the hook itself
// adds is state that is easy to get wrong and invisible in those helpers: the grouping that
// survives a reload through localStorage, controlled vs. uncontrolled ownership of it (a
// controlled table must never write storage), and which group keys are expanded.

vi.mock('@/hooks/queries/users', () => ({ useUsers: () => ({ data: [] }) }));

const mkAlert = (id: string, overrides: Partial<Alert> = {}): Alert =>
	({
		id,
		alertName: `alert ${id}`,
		status: AlertStatus.RESOLVED,
		severity: 'info',
		tags: {},
		isMuted: false,
		isSilenced: false,
		...overrides,
	}) as Alert;

// Two group-by fields (alertName, summary) so nesting exists, and a second value at each
// level so the order of the flattened rows is observable rather than incidental.
const alerts: Alert[] = [
	mkAlert('a1', { alertName: 'cpu', summary: 'high' }),
	mkAlert('a2', { alertName: 'cpu', summary: 'low' }),
	mkAlert('a3', { alertName: 'disk', summary: 'high' }),
];

const render = (controlledGroupBy?: string[], onGroupByChange?: (cols: string[]) => void) =>
	renderHook(() => useAlertGrouping(alerts, {}, controlledGroupBy, onGroupByChange));

const rowIds = (rows: FlatGroupItem[]): string[] => rows.map((row) => (row.type === 'group' ? row.key : row.alert.id));

const storedGroupBy = (): string | null => localStorage.getItem(ALERTS_GROUP_BY_STORAGE_KEY);

// The functional updater, hoisted out of the act() calls that use it.
const withSummary = (columns: string[]): string[] => [...columns, 'summary'];

beforeEach(() => {
	localStorage.clear();
});

describe('the grouping restored from storage', () => {
	test('nothing stored means no grouping', () => {
		const { result } = render();
		expect(result.current.groupByColumns).toEqual([]);
	});

	test('a stored grouping is the starting grouping', () => {
		localStorage.setItem(ALERTS_GROUP_BY_STORAGE_KEY, '["alertName"]');

		const { result } = render();
		expect(result.current.groupByColumns).toEqual(['alertName']);
	});

	test('a corrupt stored value falls back to no grouping instead of throwing', () => {
		localStorage.setItem(ALERTS_GROUP_BY_STORAGE_KEY, 'not json');

		// One render covers both claims: an unguarded JSON.parse would throw out of
		// renderHook and fail here rather than reach the assertion.
		const { result } = render();
		expect(result.current.groupByColumns).toEqual([]);
	});
});

describe('uncontrolled mode', () => {
	test('setGroupByColumns updates the grouping and persists it', () => {
		const { result } = render();

		act(() => result.current.setGroupByColumns(['alertName']));

		expect(result.current.groupByColumns).toEqual(['alertName']);
		expect(storedGroupBy()).toBe('["alertName"]');
	});

	test('a functional updater is resolved against the current grouping and persisted', () => {
		localStorage.setItem(ALERTS_GROUP_BY_STORAGE_KEY, '["alertName"]');
		const { result } = render();

		act(() => result.current.setGroupByColumns(withSummary));

		expect(result.current.groupByColumns).toEqual(['alertName', 'summary']);
		expect(storedGroupBy()).toBe('["alertName","summary"]');
	});
});

describe('controlled mode', () => {
	test('the parent’s value is the grouping, not what is in storage', () => {
		localStorage.setItem(ALERTS_GROUP_BY_STORAGE_KEY, '["alertName"]');

		const { result } = render(['summary']);
		expect(result.current.groupByColumns).toEqual(['summary']);
	});

	test('a change is handed to the parent and storage keeps its old value', () => {
		// The stored value differs from the controlled one on purpose: if controlled mode
		// ever wrote storage, the string changes rather than rewriting what is there.
		localStorage.setItem(ALERTS_GROUP_BY_STORAGE_KEY, '["disk"]');
		const onGroupByChange = vi.fn();
		const setItem = vi.spyOn(Storage.prototype, 'setItem');

		const { result } = render(['alertName'], onGroupByChange);

		expect(storedGroupBy()).toBe('["disk"]');
		expect(setItem).not.toHaveBeenCalledWith(ALERTS_GROUP_BY_STORAGE_KEY, expect.anything());

		act(() => result.current.setGroupByColumns(['summary']));

		expect(onGroupByChange).toHaveBeenCalledWith(['summary']);
		expect(storedGroupBy()).toBe('["disk"]');
		expect(setItem).not.toHaveBeenCalledWith(ALERTS_GROUP_BY_STORAGE_KEY, expect.anything());

		setItem.mockRestore();
	});

	test('a functional updater is resolved against the controlled value, not the stored one', () => {
		localStorage.setItem(ALERTS_GROUP_BY_STORAGE_KEY, '["disk"]');
		const onGroupByChange = vi.fn();
		const { result } = render(['alertName'], onGroupByChange);

		act(() => result.current.setGroupByColumns(withSummary));

		expect(onGroupByChange).toHaveBeenCalledWith(['alertName', 'summary']);
	});
});

describe('flatRows', () => {
	test('no grouping is one leaf per alert, in the order given', () => {
		const { result } = render();

		expect(rowIds(result.current.flatRows)).toEqual(['a1', 'a2', 'a3']);
		expect(result.current.flatRows.every((row) => row.type === 'leaf')).toBe(true);
	});

	test('grouping with nothing expanded shows only the top-level groups', () => {
		localStorage.setItem(ALERTS_GROUP_BY_STORAGE_KEY, '["alertName","summary"]');

		const { result } = render();
		expect(rowIds(result.current.flatRows)).toEqual(['root:cpu', 'root:disk']);
		expect(result.current.expandedGroups).toEqual(new Set());
	});
});

describe('expanding and collapsing groups', () => {
	test('toggleGroup opens a group and closes it again', () => {
		localStorage.setItem(ALERTS_GROUP_BY_STORAGE_KEY, '["alertName"]');
		const { result } = render();

		act(() => result.current.toggleGroup('root:cpu'));

		expect(rowIds(result.current.flatRows)).toEqual(['root:cpu', 'a1', 'a2', 'root:disk']);
		expect(result.current.flatRows).toContainEqual(expect.objectContaining({ key: 'root:cpu', isExpanded: true }));

		act(() => result.current.toggleGroup('root:cpu'));

		expect(rowIds(result.current.flatRows)).toEqual(['root:cpu', 'root:disk']);
	});

	test('expandAll opens every level, so every alert appears as a leaf', () => {
		localStorage.setItem(ALERTS_GROUP_BY_STORAGE_KEY, '["alertName","summary"]');
		const { result } = render();

		act(() => result.current.expandAll());

		expect(result.current.expandedGroups).toEqual(
			new Set(['root:cpu', 'root:cpu:high', 'root:cpu:low', 'root:disk', 'root:disk:high'])
		);
		expect(rowIds(result.current.flatRows)).toEqual([
			'root:cpu',
			'root:cpu:high',
			'a1',
			'root:cpu:low',
			'a2',
			'root:disk',
			'root:disk:high',
			'a3',
		]);
	});

	test('collapseAll closes everything back to the top-level groups', () => {
		localStorage.setItem(ALERTS_GROUP_BY_STORAGE_KEY, '["alertName","summary"]');
		const { result } = render();

		act(() => result.current.expandAll());
		act(() => result.current.collapseAll());

		expect(result.current.expandedGroups).toEqual(new Set());
		expect(rowIds(result.current.flatRows)).toEqual(['root:cpu', 'root:disk']);
	});
});
