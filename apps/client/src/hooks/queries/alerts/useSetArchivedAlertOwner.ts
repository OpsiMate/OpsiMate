import { alertsApi } from '@/lib/api';
import { Alert } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

interface SetArchivedAlertOwnerParams {
	alertId: string;
	ownerId: string | null;
}

export const useSetArchivedAlertOwner = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ alertId, ownerId }: SetArchivedAlertOwnerParams) => {
			const response = await alertsApi.setArchivedAlertOwner(alertId, ownerId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to set archived alert owner');
			}
			return response.data?.alert;
		},
		onMutate: async ({ alertId, ownerId }: SetArchivedAlertOwnerParams) => {
			// Cancel any outgoing refetches to avoid overwriting our optimistic update
			await queryClient.cancelQueries({ queryKey: queryKeys.archivedAlerts });

			// Snapshot the previous value
			const previousAlerts = queryClient.getQueryData<Alert[]>(queryKeys.archivedAlerts);

			// Optimistically update the alert owner
			queryClient.setQueryData<Alert[]>(queryKeys.archivedAlerts, (old) => {
				if (!old) return [];
				return old.map((alert) => (alert.id === alertId ? { ...alert, ownerId } : alert));
			});

			// Return a context object with the snapshotted value
			return { previousAlerts };
		},
		onError: (_err, _variables, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousAlerts) {
				queryClient.setQueryData(queryKeys.archivedAlerts, context.previousAlerts);
			}
		},
		onSettled: () => {
			// Always refetch after error or success to ensure server state
			queryClient.invalidateQueries({ queryKey: queryKeys.archivedAlerts });
		},
	});
};
