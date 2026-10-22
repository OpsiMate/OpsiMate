import { act, cleanup, renderHook } from '@/test/test-utils';
import { QueryObserverResult } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAlertsRefresh } from '@/components/Alerts/hooks/useAlertsRefresh';
import { ACTIVE_ALERTS_POLL_MS } from '@/lib/pollIntervals';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

interface RefetchOutcome {
	status: 'success' | 'error';
}

interface Deferred {
	promise: Promise<QueryObserverResult>;
	resolve: (result: QueryObserverResult) => void;
}

const START = new Date('2026-10-22T10:00:00Z');
const LATER = new Date('2026-10-22T10:01:00Z');

const resultOf = ({ status }: RefetchOutcome): QueryObserverResult => {
	const isError = status === 'error';
	return {
		status,
		isError,
		isSuccess: !isError,
		data: isError ? undefined : [],
		error: isError ? new Error('Network error') : null,
	} as unknown as QueryObserverResult;
};

const deferred = (): Deferred => {
	let resolve: (result: QueryObserverResult) => void = () => {};
	const promise = new Promise<QueryObserverResult>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

const ERROR_TOAST = {
	title: 'Error refreshing alerts',
	description: 'Failed to refresh alerts',
	variant: 'destructive',
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(START);
	toast.mockReset();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('useAlertsRefresh manual refresh', () => {
	test('a successful refetch shows the success toast and moves lastRefresh forward', async () => {
		const refetch = vi.fn().mockResolvedValue(resultOf({ status: 'success' }));
		const { result } = renderHook(() => useAlertsRefresh(refetch, { shouldPause: true }));
		vi.setSystemTime(LATER);

		await act(async () => {
			await result.current.handleManualRefresh();
		});

		expect(refetch).toHaveBeenCalledTimes(1);
		expect(toast).toHaveBeenCalledTimes(1);
		expect(toast).toHaveBeenCalledWith({
			title: 'Alerts refreshed',
			description: 'The alerts list has been updated.',
		});
		expect(result.current.lastRefresh).toEqual(LATER);
	});

	test('an error result shows the error toast and leaves lastRefresh alone', async () => {
		const refetch = vi.fn().mockResolvedValue(resultOf({ status: 'error' }));
		const { result } = renderHook(() => useAlertsRefresh(refetch, { shouldPause: true }));
		vi.setSystemTime(LATER);

		await act(async () => {
			await result.current.handleManualRefresh();
		});

		expect(toast).toHaveBeenCalledTimes(1);
		expect(toast).toHaveBeenCalledWith(ERROR_TOAST);
		expect(result.current.lastRefresh).toEqual(START);
	});

	test('a rejected refetch shows the error toast and leaves lastRefresh alone', async () => {
		const refetch = vi.fn().mockRejectedValue(new Error('Network error'));
		const { result } = renderHook(() => useAlertsRefresh(refetch, { shouldPause: true }));
		vi.setSystemTime(LATER);

		await act(async () => {
			await result.current.handleManualRefresh();
		});

		expect(toast).toHaveBeenCalledTimes(1);
		expect(toast).toHaveBeenCalledWith(ERROR_TOAST);
		expect(result.current.lastRefresh).toEqual(START);
	});
});

describe('useAlertsRefresh auto-refresh', () => {
	test('joins a running fetch instead of cancelling the manual refresh', () => {
		const refetch = vi.fn().mockResolvedValue(resultOf({ status: 'success' }));
		renderHook(() => useAlertsRefresh(refetch));

		act(() => vi.advanceTimersByTime(ACTIVE_ALERTS_POLL_MS));

		expect(refetch).toHaveBeenCalledTimes(1);
		expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false });
	});

	test('a tick moves lastRefresh forward only after its fetch succeeds', async () => {
		const refetch = vi.fn().mockResolvedValue(resultOf({ status: 'success' }));
		const { result } = renderHook(() => useAlertsRefresh(refetch));

		await act(async () => {
			await vi.advanceTimersByTimeAsync(ACTIVE_ALERTS_POLL_MS);
		});

		expect(result.current.lastRefresh).toEqual(new Date(START.getTime() + ACTIVE_ALERTS_POLL_MS));
	});

	test('a tick that joins a pending manual refresh which then fails leaves lastRefresh alone', async () => {
		const pending = deferred();
		const refetch = vi.fn().mockReturnValue(pending.promise);
		const { result } = renderHook(() => useAlertsRefresh(refetch));

		let refresh: Promise<void> = Promise.resolve();
		act(() => {
			refresh = result.current.handleManualRefresh();
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(ACTIVE_ALERTS_POLL_MS);
		});
		await act(async () => {
			pending.resolve(resultOf({ status: 'error' }));
			await refresh;
		});

		expect(toast).toHaveBeenCalledWith(ERROR_TOAST);
		expect(result.current.lastRefresh).toEqual(START);
	});
});

describe('useAlertsRefresh isRefreshing', () => {
	test.each<RefetchOutcome>([{ status: 'success' }, { status: 'error' }])(
		'isRefreshing is true while the refetch is pending and false after it ends with $status',
		async (outcome) => {
			const pending = deferred();
			const refetch = vi.fn().mockReturnValue(pending.promise);
			const { result } = renderHook(() => useAlertsRefresh(refetch, { shouldPause: true }));
			expect(result.current.isRefreshing).toBe(false);

			let refresh: Promise<void> = Promise.resolve();
			act(() => {
				refresh = result.current.handleManualRefresh();
			});
			expect(result.current.isRefreshing).toBe(true);

			await act(async () => {
				pending.resolve(resultOf(outcome));
				await refresh;
			});
			expect(result.current.isRefreshing).toBe(false);
		}
	);
});
