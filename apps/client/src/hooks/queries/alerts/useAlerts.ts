import { alertsApi, AlertListResponse, AlertQueryParams } from '@/lib/api';
import { isPlaygroundMode } from '@/lib/playground';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '../queryKeys';

// One infinite query serves both worlds. With a server query, each page is a filtered
// slice and nextCursor drives the scroll; the playground's mock handler ignores the
// params and returns the full list as a single page (nextCursor undefined), which is
// exactly the legacy behavior — no separate code path to drift.
export const useAlerts = (query?: AlertQueryParams, options?: { refetchIntervalMs?: number }) => {
	const playgroundMode = isPlaygroundMode();

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
		refetchInterval: playgroundMode ? false : (options?.refetchIntervalMs ?? 5 * 1000),
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
