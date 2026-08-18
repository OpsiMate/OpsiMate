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
			const previous = queryClient.getQueriesData<Alert[]>({ queryKey: queryKeys.alerts });
			queryClient.setQueriesData<Alert[]>({ queryKey: queryKeys.alerts }, (old) => {
				if (!old) return old;
				return old.map((alert) => (alert.id === alertId ? { ...alert, isRead: true } : alert));
			});
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
