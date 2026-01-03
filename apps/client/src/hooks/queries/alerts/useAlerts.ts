import { alertsApi } from '@/lib/api';
import { isPlaygroundMode } from '@/lib/playground';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useAlerts = () => {
	const playgroundMode = isPlaygroundMode();

	return useQuery({
		queryKey: [...queryKeys.alerts, playgroundMode ? 'playground' : 'api'],
		queryFn: async () => {
			const response = await alertsApi.getAllAlerts();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch alerts');
			}
			return response.data?.alerts || [];
		},
		staleTime: 5 * 1000,
		refetchInterval: playgroundMode ? false : 5 * 1000,
	});
};
