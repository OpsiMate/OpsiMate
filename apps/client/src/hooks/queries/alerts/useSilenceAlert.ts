import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

interface SilenceAlertVariables {
	alertId: string;
	// ISO expiry of the silence; null silences until manually unsilenced.
	silencedUntil?: string | null;
	comment?: string;
}

export const useSilenceAlert = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ alertId, silencedUntil, comment }: SilenceAlertVariables) => {
			const response = await alertsApi.silenceAlert(alertId, { silencedUntil, comment });
			if (!response.success) {
				throw new Error(response.error || 'Failed to silence alert');
			}
			return response.data;
		},
		onSuccess: (_data, { alertId }) => {
			// Invalidate and refetch alerts
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
			// Refresh any open alert-history panel (this records a history event server-side).
			queryClient.invalidateQueries({ queryKey: ['alertHistory'] });
			// A silence note is stored as a regular comment, so refresh the comment thread too.
			queryClient.invalidateQueries({ queryKey: [...queryKeys.alertComments, alertId] });
		},
	});
};
