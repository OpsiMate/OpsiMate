import { alertsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useAlerts = () => {
	return useQuery({
		queryKey: queryKeys.alerts,
		queryFn: async () => {
			const response = await alertsApi.getAllAlerts();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch alerts');
			}
			return response.data?.alerts || [];
		},
		staleTime: 5 * 1000,
		refetchInterval: 5 * 1000,
	});
};
