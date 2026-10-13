import { act, renderHook } from '@testing-library/react';
import { Alert, AlertSeverity, AlertStatus, AlertType } from '@OpsiMate/shared';
import { describe, expect, it, vi } from 'vitest';
import { useAlertSorting } from '@/components/Alerts/AlertsTable/hooks/useAlertSorting';

vi.mock('@/hooks/queries/users', () => ({ useUsers: () => ({ data: [] }) }));

interface ControlledSortProps {
	field: string;
	direction: 'asc' | 'desc';
}

interface ControlledModeProps {
	controlled: boolean;
}

const makeAlert = (id: string, alertName: string, startsAt: string): Alert => ({
	id,
	alertName,
	startsAt,
	updatedAt: startsAt,
	createdAt: startsAt,
	type: 'Grafana' as AlertType,
	status: AlertStatus.FIRING,
	severity: 'warning' as AlertSeverity,
	tags: {},
	alertUrl: '',
	isSilenced: false,
});
const alerts = [
	makeAlert('old', 'Zulu', '2026-01-01T00:00:00.000Z'),
	makeAlert('new', 'Beta', '2026-01-03T00:00:00.000Z'),
	makeAlert('middle', 'Alpha', '2026-01-02T00:00:00.000Z'),
];
const ids = (sorted: Alert[]) => sorted.map(({ id }) => id);

describe('useAlertSorting', () => {
	it('defaults to newest-first without mutating the input', () => {
		const input = [...alerts];
		const { result } = renderHook(() => useAlertSorting(input));
		expect(result.current.sortField).toBe('startsAt');
		expect(result.current.sortDirection).toBe('desc');
		expect(ids(result.current.sortedAlerts)).toEqual(['new', 'middle', 'old']);
		expect(ids(input)).toEqual(['old', 'new', 'middle']);
	});
	it('flips the direction when clicking the current field', () => {
		const { result } = renderHook(() => useAlertSorting(alerts));
		act(() => result.current.handleSort('startsAt'));
		expect(result.current.sortDirection).toBe('asc');
		expect(ids(result.current.sortedAlerts)).toEqual(['old', 'middle', 'new']);
		act(() => result.current.handleSort('startsAt'));
		expect(result.current.sortDirection).toBe('desc');
		expect(ids(result.current.sortedAlerts)).toEqual(['new', 'middle', 'old']);
	});
	it('starts alertName ascending and sorts alphabetically', () => {
		const { result } = renderHook(() => useAlertSorting(alerts));
		act(() => result.current.handleSort('alertName'));
		expect(result.current.sortField).toBe('alertName');
		expect(result.current.sortDirection).toBe('asc');
		expect(ids(result.current.sortedAlerts)).toEqual(['middle', 'new', 'old']);
	});
	it.each(['startsAt', 'updatedAt', 'severity', 'fix'])('starts %s descending when switching fields', (field) => {
		const { result } = renderHook(() => useAlertSorting(alerts));
		act(() => result.current.handleSort('alertName'));
		act(() => result.current.handleSort(field));
		expect(result.current.sortField).toBe(field);
		expect(result.current.sortDirection).toBe('desc');
	});
	it('follows controlled field and direction changes', () => {
		const { result, rerender } = renderHook(
			({ field, direction }: ControlledSortProps) => useAlertSorting(alerts, field, direction),
			{ initialProps: { field: 'alertName', direction: 'asc' } }
		);
		expect(result.current.sortField).toBe('alertName');
		expect(result.current.sortDirection).toBe('asc');
		expect(ids(result.current.sortedAlerts)).toEqual(['middle', 'new', 'old']);
		rerender({ field: 'startsAt', direction: 'desc' });
		expect(result.current.sortField).toBe('startsAt');
		expect(result.current.sortDirection).toBe('desc');
		expect(ids(result.current.sortedAlerts)).toEqual(['new', 'middle', 'old']);
	});
	it('reports controlled changes without updating controlled or local state', () => {
		const onSortChange = vi.fn();
		const { result, rerender } = renderHook(
			({ controlled }: ControlledModeProps) =>
				useAlertSorting(
					alerts,
					controlled ? 'startsAt' : undefined,
					controlled ? 'desc' : undefined,
					onSortChange
				),
			{ initialProps: { controlled: true } }
		);
		act(() => result.current.handleSort('alertName'));
		expect(onSortChange).toHaveBeenCalledTimes(1);
		expect(onSortChange).toHaveBeenLastCalledWith('alertName', 'asc');
		rerender({ controlled: true });
		expect(result.current.sortField).toBe('startsAt');
		expect(result.current.sortDirection).toBe('desc');
		act(() => result.current.handleSort('startsAt'));
		expect(onSortChange).toHaveBeenCalledTimes(2);
		expect(onSortChange).toHaveBeenLastCalledWith('startsAt', 'asc');
		rerender({ controlled: false });
		expect(result.current.sortField).toBe('startsAt');
		expect(result.current.sortDirection).toBe('desc');
	});
	it('returns the original array when the controlled field is empty', () => {
		const { result } = renderHook(() => useAlertSorting(alerts, '', 'asc'));
		expect(result.current.sortedAlerts).toBe(alerts);
	});
});
