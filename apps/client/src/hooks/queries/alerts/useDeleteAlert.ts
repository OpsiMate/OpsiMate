import { alertsApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { applyToAlertCaches, removeAlertFromCache, restoreAlertCaches } from './alertListCache';

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
			// The row leaves the active list on click.
			const previous = await applyToAlertCaches(queryClient, queryKeys.alerts, removeAlertFromCache(alertId));
			return { previous };
		},
		onError: (_err, _variables, context) => {
			restoreAlertCaches(queryClient, context?.previous);
		},
		onSettled: (_data, _error, { alertId }) => {
			// Always refetch after error or success to ensure server state
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
			queryClient.invalidateQueries({ queryKey: queryKeys.resolvedAlerts });
			// A manual resolve also writes a history event and possibly a resolve comment,
			// so refresh the detail queries in case the details panel is open on this alert.
			queryClient.invalidateQueries({ queryKey: queryKeys.alertHistory(alertId) });
			queryClient.invalidateQueries({ queryKey: queryKeys.alertCommentsFor(alertId) });
		},
	});
};
