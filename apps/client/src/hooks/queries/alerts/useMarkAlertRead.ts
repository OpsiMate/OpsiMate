import { alertsApi } from '@/lib/api';
import { Alert } from '@OpsiMate/shared';
import { QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

// Mark-read arrives in BURSTS: keyboard row navigation marks every unread row it steps
// onto, several per second under key-repeat. Invalidating per settle refetches the whole
// alerts prefix (list, facets, counts) once per step — a burst of redundant server
// round-trips and list re-renders. The refetch only reconciles state the optimistic
// update already applied, so one trailing invalidation after the burst carries the same
// guarantee at a fraction of the cost. Module-level: every component's mutations share
// one timer, which is exactly the coalescing we want.
let invalidateTimer: number | null = null;
const scheduleAlertsInvalidate = (queryClient: QueryClient) => {
	if (invalidateTimer !== null) window.clearTimeout(invalidateTimer);
	invalidateTimer = window.setTimeout(() => {
		invalidateTimer = null;
		void queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
	}, 400);
};

// A page of the useAlerts infinite query, as far as this updater needs to know it.
interface AlertsPageLike {
	alerts?: Alert[];
}
interface InfiniteAlertsLike {
	pages: AlertsPageLike[];
}

const hasPages = (value: object): value is InfiniteAlertsLike => Array.isArray((value as InfiniteAlertsLike).pages);

// Applies isRead to one alert wherever it lives in a cached query, WITHOUT assuming the
// cache's shape. The ['alerts'] prefix matches queries of several shapes — the infinite
// list ({pages: [{alerts}]}), facets objects, match counts — and an updater that calls
// .map on all of them throws on the first non-array. That throw is worse than a broken
// un-bold: an exception in onMutate makes react-query SKIP mutationFn entirely, so the
// server was never told either and the row stayed bold forever (broken since the list
// became paginated; the immediate refetch used to mask the optimistic path before that).
const markAlertReadInCache =
	(alertId: string) =>
	(old: unknown): unknown => {
		if (!old || typeof old !== 'object') return old;
		const markRead = (alert: Alert): Alert => (alert.id === alertId ? { ...alert, isRead: true } : alert);
		if (Array.isArray(old)) return (old as Alert[]).map(markRead);
		if (hasPages(old)) {
			return {
				...old,
				pages: old.pages.map((page) =>
					page && Array.isArray(page.alerts) ? { ...page, alerts: page.alerts.map(markRead) } : page
				),
			};
		}
		// Facets, counts, summaries — nothing here carries isRead; leave untouched.
		return old;
	};

// Marks an alert as read (unread alerts render bold). Optimistic so the row un-bolds
// immediately on click. Note: useAlerts keys its query as [...queryKeys.alerts, mode],
// so we use prefix-matching setQueriesData rather than a single setQueryData.
export const useMarkAlertRead = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (alertId: string) => {
			const response = await alertsApi.markAlertRead(alertId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to mark alert as read');
			}
			return response.data?.alert;
		},
		onMutate: async (alertId: string) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.alerts });
			const previous = queryClient.getQueriesData({ queryKey: queryKeys.alerts });
			queryClient.setQueriesData({ queryKey: queryKeys.alerts }, markAlertReadInCache(alertId));
			return { previous };
		},
		onError: (_err, _alertId, context) => {
			for (const [key, data] of context?.previous ?? []) {
				queryClient.setQueryData(key, data);
			}
		},
		onSettled: () => {
			scheduleAlertsInvalidate(queryClient);
		},
	});
};
