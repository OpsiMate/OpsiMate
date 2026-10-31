import { alertsApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { applyToAlertCaches, removeAlertFromCache, restoreAlertCaches } from './alertListCache';

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
			// The row leaves the resolved list on click; it joins the active one on the refetch.
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
		onSettled: (_data, _error, alertId) => {
			// Always refetch after error or success: the alert left one list and joined the other
			queryClient.invalidateQueries({ queryKey: queryKeys.resolvedAlerts });
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
			// The server records an UNRESOLVED history event ("Alert moved back to firing");
			// without this the open details panel keeps showing the pre-unresolve timeline.
			queryClient.invalidateQueries({ queryKey: queryKeys.alertHistory(alertId) });
		},
	});
};
