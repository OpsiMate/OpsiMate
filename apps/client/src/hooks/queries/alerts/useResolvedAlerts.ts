import { alertsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useResolvedAlerts = () => {
	return useQuery({
		queryKey: queryKeys.resolvedAlerts,
		queryFn: async () => {
			const response = await alertsApi.getAllResolvedAlerts();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch resolved alerts');
			}
			return response.data?.alerts || [];
		},
		staleTime: 30 * 1000, // 30 seconds
		refetchInterval: 30 * 1000, // Refetch every 30 seconds
	});
};
