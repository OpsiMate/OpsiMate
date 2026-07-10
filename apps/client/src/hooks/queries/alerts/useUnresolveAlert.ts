import { alertsApi } from '@/lib/api';
import { Alert } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

// Moves a resolved alert back to the active (firing) list — the reverse of resolving.
export const useUnresolveAlert = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (alertId: string) => {
			const response = await alertsApi.unresolveAlert(alertId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to unresolve alert');
			}
			return response.data;
		},
		onMutate: async (alertId: string) => {
			// Cancel any outgoing refetches to avoid overwriting our optimistic update
			await queryClient.cancelQueries({ queryKey: queryKeys.resolvedAlerts });

			// Snapshot the previous value
			const previousAlerts = queryClient.getQueryData<Alert[]>(queryKeys.resolvedAlerts);

			// Optimistically remove the alert from the resolved list
			queryClient.setQueryData<Alert[]>(queryKeys.resolvedAlerts, (old) => {
				if (!old) return [];
				return old.filter((alert) => alert.id !== alertId);
			});

			// Return a context object with the snapshotted value
			return { previousAlerts };
		},
		onError: (err, alertId, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousAlerts) {
				queryClient.setQueryData(queryKeys.resolvedAlerts, context.previousAlerts);
			}
		},
		onSettled: () => {
			// Always refetch after error or success: the alert left one list and joined the other
			queryClient.invalidateQueries({ queryKey: queryKeys.resolvedAlerts });
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};
