import { alertsApi } from '@/lib/api';
import { Alert } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

interface SetAlertOwnerParams {
	alertId: string;
	ownerId: string | null;
}

export const useSetAlertOwner = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ alertId, ownerId }: SetAlertOwnerParams) => {
			const response = await alertsApi.setAlertOwner(alertId, ownerId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to set alert owner');
			}
			return response.data?.alert;
		},
		onMutate: async ({ alertId, ownerId }: SetAlertOwnerParams) => {
			// Cancel any outgoing refetches to avoid overwriting our optimistic update
			await queryClient.cancelQueries({ queryKey: queryKeys.alerts });

			// Snapshot the previous value
			const previousAlerts = queryClient.getQueryData<Alert[]>(queryKeys.alerts);

			// Optimistically update the alert owner
			queryClient.setQueryData<Alert[]>(queryKeys.alerts, (old) => {
				if (!old) return [];
				return old.map((alert) => (alert.id === alertId ? { ...alert, ownerId } : alert));
			});

			// Return a context object with the snapshotted value
			return { previousAlerts };
		},
		onError: (_err, _variables, context) => {
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
