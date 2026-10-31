import { alertsApi, AlertListResponse, AlertQueryParams } from '@/lib/api';
import { isPlaygroundMode } from '@/lib/playground';
import { ACTIVE_ALERTS_POLL_MS } from '@/lib/pollIntervals';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '../queryKeys';

// One infinite query serves both worlds. With a server query, each page is a filtered
// slice and nextCursor drives the scroll; the playground's mock handler speaks the same
// query contract through the shared engine, so paging and totals behave identically —
// no separate code path to drift.
export const useAlerts = (query?: AlertQueryParams, options?: { refetchIntervalMs?: number }) => {
	const playgroundMode = isPlaygroundMode();
	const queryClient = useQueryClient();
	const pollMs = options?.refetchIntervalMs ?? ACTIVE_ALERTS_POLL_MS;

	const result = useInfiniteQuery({
		queryKey: [...queryKeys.alerts, playgroundMode ? 'playground' : 'api', query ?? null],
		queryFn: async ({ pageParam }): Promise<AlertListResponse> => {
			const response = await alertsApi.getAllAlerts(
				query ? { ...query, cursor: pageParam || undefined } : undefined
			);
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch alerts');
			}
			return response.data ?? { alerts: [] };
		},
		initialPageParam: '',
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
		staleTime: 5 * 1000,
		// Paused while a bulk action is pending: the server applies it one alert at a time,
		// so a poll mid-way would bring back rows the optimistic update already changed
		// (resolved rows reappearing) until the action's own refetch. That refetch updates
		// the query, which re-evaluates this and resumes polling.
		refetchInterval: () =>
			playgroundMode || queryClient.isMutating({ mutationKey: queryKeys.bulkAlertAction }) > 0 ? false : pollMs,
		// A changed query (typing, a filter click, a sort) mints a new key; without this
		// the table drops to empty and repaints from scratch when the response lands —
		// reads as "everything got deleted and re-rendered". Keeping the previous rows on
		// screen until the new page is ready makes the transition a content swap.
		placeholderData: keepPreviousData,
	});

	const alerts = useMemo(() => result.data?.pages.flatMap((page) => page.alerts) ?? [], [result.data]);
	// The server's filtered total; undefined on legacy/playground responses, where the
	// single page IS the whole list.
	const total = result.data?.pages[0]?.total ?? alerts.length;

	return {
		data: alerts,
		total,
		isLoading: result.isLoading,
		refetch: result.refetch,
		fetchNextPage: result.fetchNextPage,
		hasNextPage: result.hasNextPage,
		isFetchingNextPage: result.isFetchingNextPage,
	};
};
