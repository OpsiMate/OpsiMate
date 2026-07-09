import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useSilenceAlert = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (alertId: string) => {
			const response = await alertsApi.silenceAlert(alertId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to silence alert');
			}
			return response.data;
		},
		onSuccess: () => {
			// Invalidate and refetch alerts
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
			// Refresh any open alert-history panel (this records a history event server-side).
			queryClient.invalidateQueries({ queryKey: ['alertHistory'] });
		},
	});
};
