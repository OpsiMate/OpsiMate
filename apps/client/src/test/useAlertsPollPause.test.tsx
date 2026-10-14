import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Alert, AlertBulkActionRequest } from '@OpsiMate/shared';
import { useAlerts } from '@/hooks/queries/alerts/useAlerts';
import { useBulkAlertAction } from '@/hooks/queries/alerts/useBulkAlertAction';

const getAllAlerts = vi.fn();
const bulkAlertAction = vi.fn();
vi.mock('@/lib/api', () => ({
	alertsApi: {
		getAllAlerts: () => getAllAlerts(),
		bulkAlertAction: (request: AlertBulkActionRequest) => bulkAlertAction(request),
	},
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser: () => ({ id: 5 }) }));

// The server applies a bulk action one alert at a time, so a list poll landing mid-way
// returns the alerts it has not reached yet in their old state, undoing the optimistic
// update (resolved rows reappear) until the action's own refetch. Polling pauses while a
// bulk action is pending and resumes after it.

interface WrapperProps {
	children: ReactNode;
}

const POLL_MS = 100;

const alert = (id: string): Alert => ({ id, ownerId: null, isSilenced: false }) as Alert;

const listResponse = () => ({ success: true, data: { alerts: [alert('a1'), alert('a2')], total: 2 } });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let queryClient: QueryClient;

beforeEach(() => {
	queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
	getAllAlerts.mockReset().mockImplementation(async () => listResponse());
	bulkAlertAction.mockReset();
});

afterEach(() => {
	queryClient.clear();
});

const wrapper = ({ children }: WrapperProps) => (
	<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const renderListAndBulk = () =>
	renderHook(
		() => ({
			list: useAlerts({ sort: 'startsAt' } as never, { refetchIntervalMs: POLL_MS }),
			bulk: useBulkAlertAction(),
		}),
		{ wrapper }
	);

type RenderedHooks = ReturnType<typeof renderListAndBulk>['result'];

const listIds = (result: RenderedHooks): string[] => result.current.list.data.map((a) => a.id);

describe('useAlerts polling during a bulk action', () => {
	test('the list polls normally with no bulk action pending', async () => {
		const { result } = renderListAndBulk();
		await waitFor(() => expect(result.current.list.data).toHaveLength(2));
		const after = getAllAlerts.mock.calls.length;

		await act(() => wait(POLL_MS * 5));

		expect(getAllAlerts.mock.calls.length - after).toBeGreaterThanOrEqual(3);
	});

	test('polling pauses while a bulk resolve is pending, so resolved rows stay gone, and resumes after', async () => {
		let release: (value: unknown) => void = () => {};
		bulkAlertAction.mockImplementation(() => new Promise((resolve) => (release = resolve)));
		const { result } = renderListAndBulk();
		await waitFor(() => expect(result.current.list.data).toHaveLength(2));

		act(() => result.current.bulk.mutate({ action: 'resolve', ids: ['a1'] }));
		await waitFor(() => expect(listIds(result)).toEqual(['a2']));
		const atStart = getAllAlerts.mock.calls.length;

		// Several poll intervals pass with the request still open.
		await act(() => wait(POLL_MS * 6));
		expect(getAllAlerts.mock.calls.length).toBe(atStart);
		expect(listIds(result)).toEqual(['a2']);

		// The server finishes (and has resolved a1): the list refetches and polling resumes.
		getAllAlerts.mockImplementation(async () => ({ success: true, data: { alerts: [alert('a2')], total: 1 } }));
		act(() => release({ success: true, data: { matched: 1, succeeded: 1, failed: 0 } }));
		await waitFor(() => expect(result.current.bulk.isSuccess).toBe(true));
		const afterSettle = getAllAlerts.mock.calls.length;
		await act(() => wait(POLL_MS * 5));
		expect(getAllAlerts.mock.calls.length - afterSettle).toBeGreaterThanOrEqual(3);
		expect(listIds(result)).toEqual(['a2']);
	});
});
