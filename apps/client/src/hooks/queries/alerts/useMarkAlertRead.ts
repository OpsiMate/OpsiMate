import { alertsApi } from '@/lib/api';
import { QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { applyToAlertCaches, restoreAlertCaches, updateAlertInCache } from './alertListCache';

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

// Marks an alert as read (unread alerts render bold). Optimistic so the row un-bolds
// immediately on click, in every cached list (see alertListCache).
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
			const previous = await applyToAlertCaches(
				queryClient,
				queryKeys.alerts,
				updateAlertInCache(alertId, (alert) => ({ ...alert, isRead: true }))
			);
			return { previous };
		},
		onError: (_err, _alertId, context) => {
			restoreAlertCaches(queryClient, context?.previous);
		},
		onSettled: () => {
			scheduleAlertsInvalidate(queryClient);
		},
	});
};
