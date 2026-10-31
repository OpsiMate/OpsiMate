import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act, ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Alert, AlertBulkActionRequest } from '@OpsiMate/shared';
import { useBulkAlertAction } from '@/hooks/queries/alerts/useBulkAlertAction';

const bulkAlertAction = vi.fn();
vi.mock('@/lib/api', () => ({
	alertsApi: {
		bulkAlertAction: (request: AlertBulkActionRequest) => bulkAlertAction(request),
	},
}));

const currentUser = vi.fn();
vi.mock('@/lib/auth', () => ({
	getCurrentUser: () => currentUser(),
}));

// The selection bar's actions used to change nothing on screen until the server had
// acted on every selected alert AND the lists had refetched: seconds on a busy instance.
// An explicit selection is now applied to the cached active lists on click, mirroring
// what the server does to each alert, and rolled back if the request fails. An "all
// matching" query can't be mirrored (it targets alerts the client may not have loaded).

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

const alert = (id: string, ownerId: string | null = null): Alert =>
	({ id, ownerId, isSilenced: false, silencedUntil: null }) as Alert;

const listKey = ['alerts', 'api', { sort: 'startsAt' }] as const;
const otherListKey = ['alerts', 'api', { sort: 'severity' }] as const;
const facetsKey = ['alerts', 'facets', 'active', null] as const;
const resolvedListKey = ['resolvedAlerts', null] as const;

const seed = (): QueryClient => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const list = (): InfiniteAlerts => ({
		pages: [
			{ alerts: [alert('a1'), alert('a2', '3')], total: 4 },
			{ alerts: [alert('a3'), alert('a4')], total: 4 },
		],
		pageParams: ['', 'cursor-1'],
	});
	queryClient.setQueryData(listKey, list());
	queryClient.setQueryData(otherListKey, list());
	queryClient.setQueryData(facetsKey, { severity: { critical: 3 } });
	queryClient.setQueryData(resolvedListKey, { pages: [{ alerts: [alert('a1')], total: 1 }], pageParams: [''] });
	return queryClient;
};

const wrapperFor =
	(queryClient: QueryClient) =>
	({ children }: WrapperProps) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

// Holds the request open, so whatever the cache shows meanwhile is provably optimistic.
const hold = (): Pending => {
	const pending: Pending = { release: () => {}, fail: () => {} };
	bulkAlertAction.mockImplementation(
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
const findIn = (queryClient: QueryClient, key: readonly unknown[], id: string): Alert | undefined =>
	alertsIn(queryClient, key).find((a) => a.id === id);
const ownersIn = (queryClient: QueryClient, key: readonly unknown[]): (string | null | undefined)[] =>
	alertsIn(queryClient, key).map((a) => a.ownerId);

const ok = { success: true, data: { matched: 2, succeeded: 2, failed: 0 } };

const start = (queryClient: QueryClient, request: AlertBulkActionRequest) => {
	const { result } = renderHook(() => useBulkAlertAction(), { wrapper: wrapperFor(queryClient) });
	act(() => result.current.mutate(request));
	return result;
};

beforeEach(() => {
	bulkAlertAction.mockReset();
	currentUser.mockReset();
	currentUser.mockReturnValue({ id: 5 });
});

describe('useBulkAlertAction: assign owner', () => {
	test('the owner shows on the selected rows of every list before the server answers', async () => {
		const queryClient = seed();
		const pending = hold();

		start(queryClient, { action: 'assignOwner', ownerId: '7', ids: ['a1', 'a3'] });

		await waitFor(() => expect(ownersIn(queryClient, listKey)).toEqual(['7', '3', '7', null]));
		expect(ownersIn(queryClient, otherListKey)).toEqual(['7', '3', '7', null]);
		expect(bulkAlertAction).toHaveBeenCalledWith({ action: 'assignOwner', ownerId: '7', ids: ['a1', 'a3'] });
		act(() => pending.release(ok));
		queryClient.clear();
	});

	test('unassigning clears the owner', async () => {
		const queryClient = seed();
		const pending = hold();

		start(queryClient, { action: 'assignOwner', ownerId: null, ids: ['a2'] });

		await waitFor(() => expect(findIn(queryClient, listKey, 'a2')?.ownerId).toBeNull());
		act(() => pending.release(ok));
		queryClient.clear();
	});
});

describe('useBulkAlertAction: rollback and scope', () => {
	test('a failed request rolls every list back', async () => {
		const queryClient = seed();
		const pending = hold();
		const result = start(queryClient, { action: 'assignOwner', ownerId: '7', ids: ['a1', 'a2'] });
		await waitFor(() => expect(ownersIn(queryClient, listKey)).toEqual(['7', '7', null, null]));

		act(() => pending.fail(new Error('boom')));

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(ownersIn(queryClient, listKey)).toEqual([null, '3', null, null]);
		expect(ownersIn(queryClient, otherListKey)).toEqual([null, '3', null, null]);
		queryClient.clear();
	});

	test('the resolved list and the facets are left alone (the server acts on active alerts only)', async () => {
		const queryClient = seed();
		const resolvedBefore = queryClient.getQueryData(resolvedListKey);
		const facetsBefore = queryClient.getQueryData(facetsKey);
		const pending = hold();

		start(queryClient, { action: 'assignOwner', ownerId: '7', ids: ['a1'] });

		await waitFor(() => expect(findIn(queryClient, listKey, 'a1')?.ownerId).toBe('7'));
		expect(queryClient.getQueryData(resolvedListKey)).toBe(resolvedBefore);
		expect(queryClient.getQueryData(facetsKey)).toBe(facetsBefore);
		act(() => pending.release(ok));
		queryClient.clear();
	});

	test('an "all matching" query is not guessed at: nothing changes before the server answers', async () => {
		const queryClient = seed();
		const before = queryClient.getQueryData(listKey);
		const pending = hold();

		start(queryClient, { action: 'assignOwner', ownerId: '7', query: { filters: {} } });

		await waitFor(() => expect(bulkAlertAction).toHaveBeenCalled());
		expect(queryClient.getQueryData(listKey)).toBe(before);
		act(() => pending.release(ok));
		queryClient.clear();
	});
});

describe('useBulkAlertAction: resolve', () => {
	test('resolve takes the selected rows out of every active list and off the total', async () => {
		const queryClient = seed();
		const pending = hold();

		start(queryClient, { action: 'resolve', ids: ['a2', 'a4'] });

		await waitFor(() => expect(idsIn(queryClient, listKey)).toEqual(['a1', 'a3']));
		expect(idsIn(queryClient, otherListKey)).toEqual(['a1', 'a3']);
		expect(queryClient.getQueryData<InfiniteAlerts>(listKey)?.pages[0].total).toBe(2);
		act(() => pending.release(ok));
		queryClient.clear();
	});
});

describe('useBulkAlertAction: silence', () => {
	test('silence marks the rows silenced and hands them to the current user, like the server', async () => {
		const queryClient = seed();
		const pending = hold();
		const until = '2026-10-15T10:00:00.000Z';

		start(queryClient, { action: 'silence', silencedUntil: until, ids: ['a1', 'a2'] });

		await waitFor(() => expect(findIn(queryClient, listKey, 'a1')?.isSilenced).toBe(true));
		expect(findIn(queryClient, listKey, 'a1')).toMatchObject({ silencedUntil: until, ownerId: '5' });
		expect(findIn(queryClient, listKey, 'a2')).toMatchObject({ isSilenced: true, ownerId: '5' });
		expect(findIn(queryClient, listKey, 'a3')).toMatchObject({ isSilenced: false, ownerId: null });
		act(() => pending.release(ok));
		queryClient.clear();
	});

	test('silence without a signed-in user keeps the owners', async () => {
		currentUser.mockReturnValue(null);
		const queryClient = seed();
		const pending = hold();

		start(queryClient, { action: 'silence', silencedUntil: null, ids: ['a2'] });

		await waitFor(() => expect(findIn(queryClient, listKey, 'a2')?.isSilenced).toBe(true));
		expect(findIn(queryClient, listKey, 'a2')).toMatchObject({ silencedUntil: null, ownerId: '3' });
		act(() => pending.release(ok));
		queryClient.clear();
	});

	test('unsilence clears the silence on the selected rows', async () => {
		const queryClient = seed();
		queryClient.setQueryData<InfiniteAlerts>(listKey, {
			pages: [{ alerts: [{ ...alert('s1'), isSilenced: true, silencedUntil: '2026-10-15T10:00:00.000Z' }] }],
			pageParams: [''],
		});
		const pending = hold();

		start(queryClient, { action: 'unsilence', ids: ['s1'] });

		await waitFor(() => expect(findIn(queryClient, listKey, 's1')?.isSilenced).toBe(false));
		expect(findIn(queryClient, listKey, 's1')?.silencedUntil).toBeNull();
		act(() => pending.release(ok));
		queryClient.clear();
	});
});

describe('useBulkAlertAction: comment', () => {
	test('a comment changes no row', async () => {
		const queryClient = seed();
		const before = queryClient.getQueryData(listKey);
		const pending = hold();

		start(queryClient, { action: 'comment', comment: 'looking', ids: ['a1'] });

		await waitFor(() => expect(bulkAlertAction).toHaveBeenCalled());
		expect(queryClient.getQueryData(listKey)).toBe(before);
		act(() => pending.release(ok));
		queryClient.clear();
	});
});
