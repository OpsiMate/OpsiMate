import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useUnsilenceAlert = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (alertId: string) => {
			const response = await alertsApi.unsilenceAlert(alertId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to unsilence alert');
			}
			return response.data;
		},
		onSuccess: () => {
			// Invalidate and refetch alerts
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
			queryClient.invalidateQueries({ queryKey: ['alertHistory'] });
		},
	});
};
