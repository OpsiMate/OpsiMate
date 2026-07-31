import { renderHook, act } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useAlertsFiltering } from '@/components/Alerts/hooks/useAlertsFiltering';
import { Alert } from '@OpsiMate/shared';

const wrapper = ({ children }: { children: ReactNode }) => (
	<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
		{children}
	</QueryClientProvider>
);

const mkAlert = (id: string, ageMs: number): Alert =>
	({
		id,
		type: 'Grafana',
		status: 'firing',
		severity: 'info',
		tags: {},
		startsAt: new Date(Date.now() - ageMs).toISOString(),
		updatedAt: new Date(Date.now() - ageMs).toISOString(),
		alertUrl: '',
		alertName: id,
		createdAt: new Date().toISOString(),
		isSilenced: false,
	}) as unknown as Alert;

// Quick presets are stored without dates and resolved to a fresh window at filter time —
// these tests pin the rolling behavior that regressed when presets froze at click time.
describe('useAlertsFiltering rolling time presets', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	test('a quick preset window rolls with the clock, without any prop change', () => {
		const fresh = mkAlert('fresh', 5_000);
		const stale = mkAlert('stale', 120_000);
		const options = { filters: {}, timeRange: { from: null, to: null, preset: 'last1m' as const } };
		const { result } = renderHook(() => useAlertsFiltering([fresh, stale], options), { wrapper });

		// Stale alert (2 min old) is outside "Last 1 minute" from the start.
		expect(result.current.map((a) => a.id)).toEqual(['fresh']);

		// 75s later the fresh alert has aged out too — the window moved, the props did not.
		act(() => {
			vi.advanceTimersByTime(75_000);
		});
		expect(result.current.map((a) => a.id)).toEqual([]);
	});

	test('a custom range stays absolute and does not roll', () => {
		const alert = mkAlert('inside', 30_000);
		const from = new Date(Date.now() - 60_000);
		const to = new Date(Date.now() + 60_000);
		const options = { filters: {}, timeRange: { from, to, preset: 'custom' as const } };
		const { result } = renderHook(() => useAlertsFiltering([alert], options), { wrapper });
		expect(result.current.map((a) => a.id)).toEqual(['inside']);

		// Far beyond the custom "to": the absolute range must NOT re-anchor to now.
		act(() => {
			vi.advanceTimersByTime(10 * 60_000);
		});
		expect(result.current.map((a) => a.id)).toEqual(['inside']);
	});

	test('"today" spans from local midnight regardless of when it was selected', () => {
		const sinceMidnightMs = Date.now() - new Date().setHours(0, 0, 0, 0);
		// Clamp to now: less than a second after local midnight, "1s after midnight"
		// would otherwise be a future timestamp the today-filter may exclude.
		const earlyToday = mkAlert('early-today', Math.max(0, sinceMidnightMs - 1_000));
		const yesterday = mkAlert('yesterday', sinceMidnightMs + 3_600_000);
		const options = { filters: {}, timeRange: { from: null, to: null, preset: 'today' as const } };
		const { result } = renderHook(() => useAlertsFiltering([earlyToday, yesterday], options), { wrapper });
		expect(result.current.map((a) => a.id)).toEqual(['early-today']);
	});
});
