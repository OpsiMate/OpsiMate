import { alertsApi } from '@/lib/api';
import { Alert } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

interface SetResolvedAlertOwnerParams {
	alertId: string;
	ownerId: string | null;
}

export const useSetResolvedAlertOwner = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ alertId, ownerId }: SetResolvedAlertOwnerParams) => {
			const response = await alertsApi.setResolvedAlertOwner(alertId, ownerId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to set resolved alert owner');
			}
			return response.data?.alert;
		},
		onMutate: async ({ alertId, ownerId }: SetResolvedAlertOwnerParams) => {
			// Cancel any outgoing refetches to avoid overwriting our optimistic update
			await queryClient.cancelQueries({ queryKey: queryKeys.resolvedAlerts });

			// Snapshot the previous value
			const previousAlerts = queryClient.getQueryData<Alert[]>(queryKeys.resolvedAlerts);

			// Optimistically update the alert owner
			queryClient.setQueryData<Alert[]>(queryKeys.resolvedAlerts, (old) => {
				if (!old) return [];
				return old.map((alert) => (alert.id === alertId ? { ...alert, ownerId } : alert));
			});

			// Return a context object with the snapshotted value
			return { previousAlerts };
		},
		onError: (_err, _variables, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousAlerts) {
				queryClient.setQueryData(queryKeys.resolvedAlerts, context.previousAlerts);
			}
		},
		onSettled: () => {
			// Always refetch after error or success to ensure server state
			queryClient.invalidateQueries({ queryKey: queryKeys.resolvedAlerts });
			queryClient.invalidateQueries({ queryKey: ['alertHistory'] });
		},
	});
};
