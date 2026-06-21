import { alertsApi } from '@/lib/api';
import { Alert } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

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
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};
