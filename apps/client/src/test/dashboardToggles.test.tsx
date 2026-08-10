import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { DashboardProvider, DashboardState, useDashboard } from '@/context/DashboardContext';
import { DASHBOARD_STORAGE_KEY, loadFromStorage, readLegacySeverityColors } from '@/context/DashboardContext.utils';

// "Split by owner" and "Severity colors" are dashboard fields, so a saved dashboard
// reproduces the view the user works with. Severity colors used to be a per-browser
// localStorage flag, which stays as the fallback for anything with no dashboard value —
// but must never override an explicit one.

const LEGACY_KEY = 'opsimate-alerts-severity-colors';

const defaults: DashboardState = {
	id: null,
	name: '',
	type: 'alerts',
	description: '',
	visibleColumns: [],
	filters: {},
	columnOrder: [],
	splitByAssignment: false,
	severityColors: false,
	groupBy: [],
	query: '',
	timeRange: { from: null, to: null, preset: null },
};

const wrapper = ({ children }: { children: ReactNode }) => <DashboardProvider>{children}</DashboardProvider>;

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('legacy severity-colors preference', () => {
	test('is inherited when there is no stored draft', () => {
		localStorage.setItem(LEGACY_KEY, 'true');
		expect(loadFromStorage(defaults).severityColors).toBe(true);
	});

	test('is inherited by a draft stored before the field existed', () => {
		localStorage.setItem(LEGACY_KEY, 'true');
		localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify({ name: 'old draft', query: 'cpu' }));

		const loaded = loadFromStorage(defaults);
		expect(loaded.severityColors).toBe(true);
		expect(loaded.query).toBe('cpu');
	});

	test('never overrides a draft that turned the colors off', () => {
		localStorage.setItem(LEGACY_KEY, 'true');
		localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify({ severityColors: false }));

		expect(loadFromStorage(defaults).severityColors).toBe(false);
	});

	test('defaults to off when the flag was never set', () => {
		expect(readLegacySeverityColors()).toBe(false);
		expect(loadFromStorage(defaults).severityColors).toBe(false);
	});

	test('an inherited preference does not make the dashboard look dirty', () => {
		localStorage.setItem(LEGACY_KEY, 'true');
		const { result } = renderHook(() => useDashboard(), { wrapper });

		expect(result.current.dashboardState.severityColors).toBe(true);
		expect(result.current.isDirty).toBe(false);
	});
});

describe('toolbar toggles mark the dashboard dirty', () => {
	test.each([['severityColors' as const], ['splitByAssignment' as const]])('%s', (field) => {
		const { result } = renderHook(() => useDashboard(), { wrapper });
		expect(result.current.isDirty).toBe(false);

		act(() => result.current.updateDashboardField(field, true));

		expect(result.current.dashboardState[field]).toBe(true);
		expect(result.current.isDirty).toBe(true);
	});

	test('toggling back to the saved value clears the dirty flag', () => {
		const { result } = renderHook(() => useDashboard(), { wrapper });

		act(() => result.current.updateDashboardField('splitByAssignment', true));
		expect(result.current.isDirty).toBe(true);

		act(() => result.current.updateDashboardField('splitByAssignment', false));
		expect(result.current.isDirty).toBe(false);
	});

	test.each([['splitByAssignment' as const], ['severityColors' as const]])(
		'%s survives a remount, so a reload keeps it',
		(field) => {
			const first = renderHook(() => useDashboard(), { wrapper });
			act(() => first.result.current.updateDashboardField(field, true));
			first.unmount();

			const second = renderHook(() => useDashboard(), { wrapper });
			expect(second.result.current.dashboardState[field]).toBe(true);
		}
	);
});

describe('starting a new dashboard', () => {
	test('keeps honouring the legacy severity-colors preference', () => {
		localStorage.setItem(LEGACY_KEY, 'true');
		const { result } = renderHook(() => useDashboard(), { wrapper });

		act(() => result.current.resetDashboard());

		// A fresh draft is the same situation as a first visit, which does inherit the
		// preference — the two paths must not disagree.
		expect(result.current.dashboardState.severityColors).toBe(true);
		expect(result.current.isDirty).toBe(false);
	});

	test('clears everything else back to defaults', () => {
		const { result } = renderHook(() => useDashboard(), { wrapper });
		act(() => result.current.updateDashboardField('splitByAssignment', true));
		act(() => result.current.updateDashboardField('query', 'cpu'));

		act(() => result.current.resetDashboard());

		expect(result.current.dashboardState.splitByAssignment).toBe(false);
		expect(result.current.dashboardState.query).toBe('');
		expect(result.current.dashboardState.severityColors).toBe(false);
		expect(result.current.isDirty).toBe(false);
	});
});
