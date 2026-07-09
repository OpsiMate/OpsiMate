import { alertsApi } from '@/lib/api';
import { Alert } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useDeleteResolvedAlert = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (alertId: string) => {
			const response = await alertsApi.deleteResolvedAlert(alertId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to delete resolved alert');
			}
			return response.data;
		},
		onMutate: async (alertId: string) => {
			// Cancel any outgoing refetches to avoid overwriting our optimistic update
			await queryClient.cancelQueries({ queryKey: queryKeys.resolvedAlerts });

			// Snapshot the previous value
			const previousAlerts = queryClient.getQueryData<Alert[]>(queryKeys.resolvedAlerts);

			// Optimistically update by removing the alert
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
			// Always refetch after error or success to ensure server state
			queryClient.invalidateQueries({ queryKey: queryKeys.resolvedAlerts });
		},
	});
};
