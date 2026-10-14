import { alertsApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { applyToAlertCaches, restoreAlertCaches, updateAlertInCache } from './alertListCache';

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
			// Every cached list (one per filter/sort), so the owner shows on click.
			const previous = await applyToAlertCaches(
				queryClient,
				queryKeys.alerts,
				updateAlertInCache(alertId, (alert) => ({ ...alert, ownerId }))
			);
			return { previous };
		},
		onError: (_err, _variables, context) => {
			restoreAlertCaches(queryClient, context?.previous);
		},
		onSettled: () => {
			// Always refetch after error or success to ensure server state
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
			queryClient.invalidateQueries({ queryKey: ['alertHistory'] });
		},
	});
};
