import { alertsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useArchivedAlerts = () => {
	return useQuery({
		queryKey: queryKeys.archivedAlerts,
		queryFn: async () => {
			const response = await alertsApi.getAllArchivedAlerts();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch archived alerts');
			}
			return response.data?.alerts || [];
		},
		staleTime: 30 * 1000, // 30 seconds
		refetchInterval: 30 * 1000, // Refetch every 30 seconds
	});
};

