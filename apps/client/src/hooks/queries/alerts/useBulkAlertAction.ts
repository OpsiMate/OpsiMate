import { alertsApi } from '@/lib/api';
import { AlertBulkActionRequest } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

// One request for a whole bulk action instead of a fan-out of per-alert calls. The
// result carries how many alerts matched and how many succeeded, so callers can toast
// an honest count.
export const useBulkAlertAction = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (variables: AlertBulkActionRequest) => {
			const response = await alertsApi.bulkAlertAction(variables);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Bulk alert action failed');
			}
			return response.data;
		},
		onSuccess: () => {
			// Every bulk action changes list membership, counts, or row fields — refresh
			// the active lists and everything derived from them (facets, group summaries),
			// the resolved list (bulk resolve moves rows there; it lives under its own
			// root key), and the per-alert history/comment panels, which have no poll of
			// their own and would otherwise show stale content if one of the targets is
			// open in the details panel.
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
			queryClient.invalidateQueries({ queryKey: queryKeys.resolvedAlerts });
			queryClient.invalidateQueries({ queryKey: queryKeys.alertComments });
			queryClient.invalidateQueries({ queryKey: ['alertHistory'] });
		},
	});
};
