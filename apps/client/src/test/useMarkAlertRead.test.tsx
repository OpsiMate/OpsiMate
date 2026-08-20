import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act, ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Alert } from '@OpsiMate/shared';
import { useMarkAlertRead } from '@/hooks/queries/alerts/useMarkAlertRead';

const markAlertRead = vi.fn();
vi.mock('@/lib/api', () => ({
	alertsApi: {
		markAlertRead: (id: string) => markAlertRead(id),
	},
}));

// The ['alerts'] prefix matches queries of SEVERAL shapes at once: the infinite list
// ({pages}), facets objects, match counts. The regression pinned here: an optimistic
// updater that assumed Alert[] threw on the first non-array cache, and an onMutate
// throw makes react-query skip mutationFn — so the server was never told and the row
// stayed bold forever. The un-bold has to work with all of these shapes coexisting.

const alert = (id: string, isRead: boolean): Alert => ({ id, isRead }) as Alert;

interface SeededCaches {
	queryClient: QueryClient;
	infiniteKey: readonly unknown[];
	facetsKey: readonly unknown[];
	countKey: readonly unknown[];
}

const seedCaches = (): SeededCaches => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const infiniteKey = ['alerts', 'api', null] as const;
	const facetsKey = ['alerts', 'facets', 'active', null] as const;
	const countKey = ['alerts', 'match-count', null] as const;
	queryClient.setQueryData(infiniteKey, {
		pages: [{ alerts: [alert('a1', false), alert('a2', true)], total: 2 }],
		pageParams: [''],
	});
	queryClient.setQueryData(facetsKey, { severity: { critical: 3 } });
	queryClient.setQueryData(countKey, 42);
	return { queryClient, infiniteKey, facetsKey, countKey };
};

describe('useMarkAlertRead', () => {
	beforeEach(() => {
		markAlertRead.mockReset();
		markAlertRead.mockResolvedValue({ success: true, data: { alert: alert('a1', true) } });
	});

	test('optimistically flips isRead inside the infinite pages and still calls the server', async () => {
		const { queryClient, infiniteKey } = seedCaches();
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(() => useMarkAlertRead(), { wrapper });

		// Server held pending so the flip below is provably the OPTIMISTIC one.
		let releaseServer: (value: unknown) => void = () => {};
		markAlertRead.mockImplementation(() => new Promise((resolve) => (releaseServer = resolve)));

		act(() => result.current.mutate('a1'));

		await waitFor(() => {
			const data = queryClient.getQueryData<{ pages: { alerts: Alert[] }[] }>(infiniteKey);
			expect(data?.pages[0].alerts.find((a) => a.id === 'a1')?.isRead).toBe(true);
			expect(data?.pages[0].alerts.find((a) => a.id === 'a2')?.isRead).toBe(true);
		});

		// The server call MUST happen — the old updater threw in onMutate, and
		// react-query then skips mutationFn entirely.
		expect(markAlertRead).toHaveBeenCalledWith('a1');
		act(() => releaseServer({ success: true, data: { alert: alert('a1', true) } }));
		queryClient.clear();
	});

	test('non-list caches under the same prefix are left byte-identical', async () => {
		const { queryClient, facetsKey, countKey } = seedCaches();
		const facetsBefore = queryClient.getQueryData(facetsKey);
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(() => useMarkAlertRead(), { wrapper });

		act(() => result.current.mutate('a1'));
		await waitFor(() => expect(markAlertRead).toHaveBeenCalled());

		expect(queryClient.getQueryData(facetsKey)).toBe(facetsBefore);
		expect(queryClient.getQueryData(countKey)).toBe(42);
		queryClient.clear();
	});

	test('a plain Alert[] cache (pre-pagination shape) still updates', async () => {
		const { queryClient } = seedCaches();
		const flatKey = ['alerts', 'legacy'] as const;
		queryClient.setQueryData(flatKey, [alert('a1', false)]);
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(() => useMarkAlertRead(), { wrapper });

		act(() => result.current.mutate('a1'));

		await waitFor(() => expect(queryClient.getQueryData<Alert[]>(flatKey)?.[0].isRead).toBe(true));
		await waitFor(() => expect(markAlertRead).toHaveBeenCalled());
		queryClient.clear();
	});
});
