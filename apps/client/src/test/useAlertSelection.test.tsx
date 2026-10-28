import { act, renderHook } from '@testing-library/react';
import { Alert, AlertSeverity, AlertStatus } from '@OpsiMate/shared';
import { describe, expect, test, vi } from 'vitest';
import { useAlertSelection } from '@/components/Alerts/AlertsTable/hooks/useAlertSelection';

const alert = (id: string, status: AlertStatus = AlertStatus.FIRING): Alert => ({
	id,
	type: 'Custom',
	status,
	severity: AlertSeverity.WARNING,
	tags: {},
	startsAt: '2026-10-01T00:00:00.000Z',
	updatedAt: '2026-10-01T00:00:00.000Z',
	createdAt: '2026-10-01T00:00:00.000Z',
	alertUrl: `https://example.test/alerts/${id}`,
	alertName: `Alert ${id}`,
	isSilenced: false,
});

// The split-by-owner view renders two tables over one shared selection, so a "pane" here is
// just the row list the hook is given; rows picked in the other pane live only in
// `selectedAlerts`.
const activeRows = [alert('active-1'), alert('active-2')];
const resolvedRows = [alert('resolved-1', AlertStatus.RESOLVED), alert('resolved-2', AlertStatus.RESOLVED)];

type Props = Parameters<typeof useAlertSelection>[0];

const renderSelection = (props: Props) =>
	renderHook((current: Props) => useAlertSelection(current), { initialProps: props });

describe('useAlertSelection allSelected', () => {
	test('is false for an empty row list', () => {
		const { result } = renderSelection({ sortedAlerts: [], selectedAlerts: [] });

		expect(result.current.allSelected).toBe(false);
	});

	test('is all-selected only when every row of THIS table is selected', () => {
		const partial = renderSelection({ sortedAlerts: activeRows, selectedAlerts: [activeRows[0]] });
		expect(partial.result.current.allSelected).toBe(false);

		const none = renderSelection({ sortedAlerts: activeRows, selectedAlerts: [] });
		expect(none.result.current.allSelected).toBe(false);

		const complete = renderSelection({ sortedAlerts: activeRows, selectedAlerts: activeRows });
		expect(complete.result.current.allSelected).toBe(true);
	});

	test('ignores picks that belong to the other table', () => {
		const otherPaneOnly = renderSelection({ sortedAlerts: activeRows, selectedAlerts: resolvedRows });
		expect(otherPaneOnly.result.current.allSelected).toBe(false);

		// Same count as the other pane's two picks, which is exactly the case count
		// comparisons used to get wrong.
		const everyRowPlusOtherPane = renderSelection({
			sortedAlerts: activeRows,
			selectedAlerts: [...activeRows, ...resolvedRows],
		});
		expect(everyRowPlusOtherPane.result.current.allSelected).toBe(true);
	});
});

describe('useAlertSelection handleSelectAll', () => {
	test('unions with the existing selection instead of replacing it', () => {
		const onSelectAlerts = vi.fn();
		const { result } = renderSelection({
			sortedAlerts: activeRows,
			selectedAlerts: [resolvedRows[0]],
			onSelectAlerts,
		});

		act(() => result.current.handleSelectAll());

		expect(onSelectAlerts).toHaveBeenCalledTimes(1);
		expect(onSelectAlerts).toHaveBeenCalledWith([resolvedRows[0], ...activeRows]);
	});

	test('un-selects everything when this table is the whole selection', () => {
		const onSelectAlerts = vi.fn();
		const { result } = renderSelection({
			sortedAlerts: activeRows,
			selectedAlerts: activeRows,
			onSelectAlerts,
		});

		act(() => result.current.handleSelectAll());

		// allSelected is true, so this is the un-select path: only this table's rows go.
		expect(onSelectAlerts).toHaveBeenCalledWith([]);
	});

	test('un-selects only this table’s rows', () => {
		const onSelectAlerts = vi.fn();
		const { result } = renderSelection({
			sortedAlerts: activeRows,
			selectedAlerts: [...activeRows, ...resolvedRows],
			onSelectAlerts,
		});

		act(() => result.current.handleSelectAll());

		expect(onSelectAlerts).toHaveBeenCalledTimes(1);
		expect(onSelectAlerts).toHaveBeenCalledWith(resolvedRows);
	});
});

describe('useAlertSelection handleSelectAlert', () => {
	test('toggles a single id and keeps the other table’s picks', () => {
		const onSelectAlerts = vi.fn();
		const adding = renderSelection({ sortedAlerts: activeRows, selectedAlerts: [], onSelectAlerts });

		act(() => adding.result.current.handleSelectAlert(activeRows[0]));
		expect(onSelectAlerts).toHaveBeenLastCalledWith([activeRows[0]]);

		const removing = renderSelection({
			sortedAlerts: activeRows,
			selectedAlerts: [activeRows[0], resolvedRows[0]],
			onSelectAlerts,
		});

		act(() => removing.result.current.handleSelectAlert(activeRows[0]));
		expect(onSelectAlerts).toHaveBeenLastCalledWith([resolvedRows[0]]);
	});

	test('does nothing without an onSelectAlerts handler', () => {
		const { result } = renderSelection({ sortedAlerts: activeRows, selectedAlerts: [] });

		const selectAll = () => act(() => result.current.handleSelectAll());
		const selectOne = () => act(() => result.current.handleSelectAlert(activeRows[0]));

		expect(selectAll).not.toThrow();
		expect(selectOne).not.toThrow();
		expect(result.current.allSelected).toBe(false);
	});
});
