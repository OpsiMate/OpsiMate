import { alertsApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { applyToAlertCaches, removeAlertFromCache, restoreAlertCaches } from './alertListCache';

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
			// The row leaves the resolved list on click.
			const previous = await applyToAlertCaches(
				queryClient,
				queryKeys.resolvedAlerts,
				removeAlertFromCache(alertId)
			);
			return { previous };
		},
		onError: (_err, _alertId, context) => {
			restoreAlertCaches(queryClient, context?.previous);
		},
		onSettled: () => {
			// Always refetch after error or success to ensure server state
			queryClient.invalidateQueries({ queryKey: queryKeys.resolvedAlerts });
		},
	});
};
