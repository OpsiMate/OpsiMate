import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act, ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Alert } from '@OpsiMate/shared';
import { useSetAlertOwner } from '@/hooks/queries/alerts/useSetAlertOwner';
import { useSetResolvedAlertOwner } from '@/hooks/queries/alerts/useSetResolvedAlertOwner';
import { useDeleteAlert } from '@/hooks/queries/alerts/useDeleteAlert';
import { useUnresolveAlert } from '@/hooks/queries/alerts/useUnresolveAlert';
import { useDeleteResolvedAlert } from '@/hooks/queries/alerts/useDeleteResolvedAlert';

const setAlertOwner = vi.fn();
const setResolvedAlertOwner = vi.fn();
const deleteAlert = vi.fn();
const unresolveAlert = vi.fn();
const deleteResolvedAlert = vi.fn();
vi.mock('@/lib/api', () => ({
	alertsApi: {
		setAlertOwner: (id: string, ownerId: string | null) => setAlertOwner(id, ownerId),
		setResolvedAlertOwner: (id: string, ownerId: string | null) => setResolvedAlertOwner(id, ownerId),
		deleteAlert: (id: string, comment?: string) => deleteAlert(id, comment),
		unresolveAlert: (id: string) => unresolveAlert(id),
		deleteResolvedAlert: (id: string) => deleteResolvedAlert(id),
	},
}));

// The tables read infinite queries keyed [...prefix, mode, query]: one cache entry per
// filter/sort combination. The optimistic updates used to write the bare prefix key as a
// plain Alert[], which no table reads, so an assign (or resolve) only showed once the
// refetch landed, seconds later on a busy instance. These pin that the change is visible
// in the lists the tables read BEFORE the server answers, and rolled back if it fails.

interface AlertsPage {
	alerts: Alert[];
	total?: number;
}

interface InfiniteAlerts {
	pages: AlertsPage[];
	pageParams: string[];
}

interface WrapperProps {
	children: ReactNode;
}

interface Pending {
	release: (value: unknown) => void;
	fail: (reason: unknown) => void;
}

const alert = (id: string, ownerId: string | null = null): Alert => ({ id, ownerId }) as Alert;

const activeListKey = ['alerts', 'api', { sort: 'startsAt' }] as const;
const otherActiveListKey = ['alerts', 'api', { sort: 'severity' }] as const;
const facetsKey = ['alerts', 'facets', 'active', null] as const;
const countKey = ['alerts', 'match-count', null] as const;
const resolvedListKey = ['resolvedAlerts', { sort: 'startsAt' }] as const;

const seed = (): QueryClient => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const list = (): InfiniteAlerts => ({
		pages: [
			{ alerts: [alert('a1'), alert('a2')], total: 3 },
			{ alerts: [alert('a3')], total: 3 },
		],
		pageParams: ['', 'cursor-1'],
	});
	queryClient.setQueryData(activeListKey, list());
	queryClient.setQueryData(otherActiveListKey, list());
	queryClient.setQueryData(facetsKey, { severity: { critical: 3 } });
	queryClient.setQueryData(countKey, 42);
	queryClient.setQueryData(resolvedListKey, list());
	return queryClient;
};

const wrapperFor =
	(queryClient: QueryClient) =>
	({ children }: WrapperProps) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

// Holds the server call open, so whatever the cache shows meanwhile is provably optimistic.
const hold = (mock: ReturnType<typeof vi.fn>): Pending => {
	const pending: Pending = { release: () => {}, fail: () => {} };
	mock.mockImplementation(
		() =>
			new Promise((resolve, reject) => {
				pending.release = resolve;
				pending.fail = reject;
			})
	);
	return pending;
};

const alertsIn = (queryClient: QueryClient, key: readonly unknown[]): Alert[] =>
	queryClient.getQueryData<InfiniteAlerts>(key)?.pages.flatMap((page) => page.alerts) ?? [];
const idsIn = (queryClient: QueryClient, key: readonly unknown[]): string[] =>
	alertsIn(queryClient, key).map((a) => a.id);
const ownerIn = (queryClient: QueryClient, key: readonly unknown[], id: string): string | null | undefined =>
	alertsIn(queryClient, key).find((a) => a.id === id)?.ownerId;
const totalIn = (queryClient: QueryClient, key: readonly unknown[]): number | undefined =>
	queryClient.getQueryData<InfiniteAlerts>(key)?.pages[0].total;

beforeEach(() => {
	for (const mock of [setAlertOwner, setResolvedAlertOwner, deleteAlert, unresolveAlert, deleteResolvedAlert]) {
		mock.mockReset();
	}
});

describe('useSetAlertOwner', () => {
	test('the owner shows in every cached list before the server answers', async () => {
		const queryClient = seed();
		const pending = hold(setAlertOwner);
		const { result } = renderHook(() => useSetAlertOwner(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ alertId: 'a3', ownerId: '7' }));

		await waitFor(() => {
			expect(ownerIn(queryClient, activeListKey, 'a3')).toBe('7');
			expect(ownerIn(queryClient, otherActiveListKey, 'a3')).toBe('7');
		});
		expect(ownerIn(queryClient, activeListKey, 'a1')).toBeNull();
		expect(setAlertOwner).toHaveBeenCalledWith('a3', '7');
		// Nothing stray is written under the bare prefix key.
		expect(queryClient.getQueryData(['alerts'])).toBeUndefined();

		act(() => pending.release({ success: true, data: { alert: alert('a3', '7') } }));
		queryClient.clear();
	});

	test('facets and counts under the same prefix are left untouched', async () => {
		const queryClient = seed();
		const facetsBefore = queryClient.getQueryData(facetsKey);
		const pending = hold(setAlertOwner);
		const { result } = renderHook(() => useSetAlertOwner(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ alertId: 'a1', ownerId: '7' }));
		await waitFor(() => expect(setAlertOwner).toHaveBeenCalled());

		expect(queryClient.getQueryData(facetsKey)).toBe(facetsBefore);
		expect(queryClient.getQueryData(countKey)).toBe(42);
		act(() => pending.release({ success: true, data: { alert: alert('a1', '7') } }));
		queryClient.clear();
	});

	test('a failed assign rolls every list back', async () => {
		const queryClient = seed();
		const pending = hold(setAlertOwner);
		const { result } = renderHook(() => useSetAlertOwner(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ alertId: 'a1', ownerId: '7' }));
		await waitFor(() => expect(alertsIn(queryClient, activeListKey)[0].ownerId).toBe('7'));

		act(() => pending.fail(new Error('boom')));
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(alertsIn(queryClient, activeListKey)[0].ownerId).toBeNull();
		expect(alertsIn(queryClient, otherActiveListKey)[0].ownerId).toBeNull();
		queryClient.clear();
	});
});

describe('useSetResolvedAlertOwner', () => {
	test('the owner shows in the resolved list before the server answers', async () => {
		const queryClient = seed();
		const pending = hold(setResolvedAlertOwner);
		const { result } = renderHook(() => useSetResolvedAlertOwner(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ alertId: 'a2', ownerId: '9' }));

		await waitFor(() => expect(ownerIn(queryClient, resolvedListKey, 'a2')).toBe('9'));
		// The active lists are a different table.
		expect(ownerIn(queryClient, activeListKey, 'a2')).toBeNull();
		act(() => pending.release({ success: true, data: { alert: alert('a2', '9') } }));
		queryClient.clear();
	});
});

describe('useDeleteAlert (resolve)', () => {
	test('the row leaves every active list and the total drops, before the server answers', async () => {
		const queryClient = seed();
		const pending = hold(deleteAlert);
		const { result } = renderHook(() => useDeleteAlert(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ alertId: 'a3' }));

		await waitFor(() => {
			expect(idsIn(queryClient, activeListKey)).toEqual(['a1', 'a2']);
			expect(idsIn(queryClient, otherActiveListKey)).toEqual(['a1', 'a2']);
		});
		expect(totalIn(queryClient, activeListKey)).toBe(2);
		expect(queryClient.getQueryData(countKey)).toBe(42);
		act(() => pending.release({ success: true }));
		queryClient.clear();
	});

	test('a failed resolve puts the row and the total back', async () => {
		const queryClient = seed();
		const pending = hold(deleteAlert);
		const { result } = renderHook(() => useDeleteAlert(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate({ alertId: 'a1' }));
		await waitFor(() => expect(idsIn(queryClient, activeListKey)).toEqual(['a2', 'a3']));

		act(() => pending.fail(new Error('boom')));
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(idsIn(queryClient, activeListKey)).toEqual(['a1', 'a2', 'a3']);
		expect(totalIn(queryClient, activeListKey)).toBe(3);
		queryClient.clear();
	});
});

describe('useUnresolveAlert and useDeleteResolvedAlert', () => {
	test('unresolve takes the row out of the resolved list before the server answers', async () => {
		const queryClient = seed();
		const pending = hold(unresolveAlert);
		const { result } = renderHook(() => useUnresolveAlert(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate('a2'));

		await waitFor(() => expect(idsIn(queryClient, resolvedListKey)).toEqual(['a1', 'a3']));
		expect(totalIn(queryClient, resolvedListKey)).toBe(2);
		act(() => pending.release({ success: true }));
		queryClient.clear();
	});

	test('a permanent delete takes the row out of the resolved list before the server answers', async () => {
		const queryClient = seed();
		const pending = hold(deleteResolvedAlert);
		const { result } = renderHook(() => useDeleteResolvedAlert(), { wrapper: wrapperFor(queryClient) });

		act(() => result.current.mutate('a1'));

		await waitFor(() => expect(idsIn(queryClient, resolvedListKey)).toEqual(['a2', 'a3']));
		act(() => pending.release({ success: true }));
		queryClient.clear();
	});
});
