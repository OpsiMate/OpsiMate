import { queryKeys } from '@/hooks/queries/queryKeys';
import { alertsApi } from '@/lib/api';
import { AlertHistory } from '@OpsiMate/shared';
import { useQuery } from '@tanstack/react-query';

// The one definition of "fetch this alert's history": the details panel queries it on
// its own, the incident panel fans it out over every member (useMergedIncidentHistory).
// Sharing the key AND the fetch keeps both views on the same cache entry, so a mutation
// that invalidates queryKeys.alertHistory(id) refreshes whichever is open.
export const alertHistoryQueryOptions = (alertId: string) => ({
	queryKey: queryKeys.alertHistory(alertId),
	queryFn: async (): Promise<AlertHistory | null> => {
		const response = await alertsApi.getAlertHistory(alertId);
		if (!response.success) {
			throw new Error(response.error || 'Failed to fetch alert history');
		}
		return response.data ?? null;
	},
});

// Fetches an alert's history timeline. Backed by React Query keyed on the alert id, so any
// mutation that records a history event (ownership, silence, action run) can invalidate
// queryKeys.alertHistory(...) and the open panel refreshes immediately — no need to reopen it.
export const useAlertHistory = (alertId: string | undefined): AlertHistory | null => {
	const { data } = useQuery({
		...alertHistoryQueryOptions(alertId ?? 'none'),
		enabled: !!alertId,
	});

	return data ?? null;
};
