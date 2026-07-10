import { queryKeys } from '@/hooks/queries/queryKeys';
import { alertsApi } from '@/lib/api';
import { AlertHistory } from '@OpsiMate/shared';
import { useQuery } from '@tanstack/react-query';

// Fetches an alert's history timeline. Backed by React Query keyed on the alert id, so any
// mutation that records a history event (ownership, silence, action run) can invalidate
// queryKeys.alertHistory(...) and the open panel refreshes immediately — no need to reopen it.
export const useAlertHistory = (alertId: string | undefined): AlertHistory | null => {
	const { data } = useQuery({
		queryKey: alertId ? queryKeys.alertHistory(alertId) : ['alertHistory', 'none'],
		enabled: !!alertId,
		queryFn: async (): Promise<AlertHistory | null> => {
			if (!alertId) return null;
			const response = await alertsApi.getAlertHistory(alertId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch alert history');
			}
			return response.data ?? null;
		},
	});

	return data ?? null;
};
