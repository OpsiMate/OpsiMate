import { alertsApi, AlertListResponse, AlertQueryParams } from '@/lib/api';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '../queryKeys';

// Mirror of useAlerts over the resolved list — see that hook for the single-path
// design; only the poll cadence differs (resolved alerts change less).
export const useResolvedAlerts = (query?: AlertQueryParams, options?: { refetchIntervalMs?: number }) => {
	const result = useInfiniteQuery({
		queryKey: [...queryKeys.resolvedAlerts, query ?? null],
		queryFn: async ({ pageParam }): Promise<AlertListResponse> => {
			const response = await alertsApi.getAllResolvedAlerts(
				query ? { ...query, cursor: pageParam || undefined } : undefined
			);
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch resolved alerts');
			}
			return response.data ?? { alerts: [] };
		},
		initialPageParam: '',
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
		staleTime: 30 * 1000,
		refetchInterval: options?.refetchIntervalMs ?? 30 * 1000,
	});

	const alerts = useMemo(() => result.data?.pages.flatMap((page) => page.alerts) ?? [], [result.data]);
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
