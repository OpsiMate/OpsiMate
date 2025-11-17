import { alertsApi } from '@/lib/api';
import { Alert } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useDeleteAlert = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (alertId: string) => {
			const response = await alertsApi.deleteAlert(alertId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to delete alert');
			}
			return response.data;
		},
		onMutate: async (alertId: string) => {
			// Cancel any outgoing refetches to avoid overwriting our optimistic update
			await queryClient.cancelQueries({ queryKey: queryKeys.alerts });

			// Snapshot the previous value
			const previousAlerts = queryClient.getQueryData<Alert[]>(queryKeys.alerts);

			// Optimistically update by removing the alert
			queryClient.setQueryData<Alert[]>(queryKeys.alerts, (old) => {
				if (!old) return [];
				return old.filter((alert) => alert.id !== alertId);
			});

			// Return a context object with the snapshotted value
			return { previousAlerts };
		},
		onError: (err, alertId, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousAlerts) {
				queryClient.setQueryData(queryKeys.alerts, context.previousAlerts);
			}
		},
		onSettled: () => {
			// Always refetch after error or success to ensure server state
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};
