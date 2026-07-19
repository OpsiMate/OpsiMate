import { alertsApi } from '@/lib/api';
import { Alert } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

interface DeleteAlertVariables {
	alertId: string;
	comment?: string;
}

export const useDeleteAlert = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ alertId, comment }: DeleteAlertVariables) => {
			const response = await alertsApi.deleteAlert(alertId, comment);
			if (!response.success) {
				throw new Error(response.error || 'Failed to delete alert');
			}
			return response.data;
		},
		onMutate: async ({ alertId }: DeleteAlertVariables) => {
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
		onSettled: (_data, _error, { alertId }) => {
			// Always refetch after error or success to ensure server state
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
			queryClient.invalidateQueries({ queryKey: queryKeys.resolvedAlerts });
			// A manual resolve also writes a history event and possibly a resolve comment,
			// so refresh the detail queries in case the details panel is open on this alert.
			queryClient.invalidateQueries({ queryKey: queryKeys.alertHistory(alertId) });
			queryClient.invalidateQueries({ queryKey: [...queryKeys.alertComments, alertId] });
		},
	});
};
