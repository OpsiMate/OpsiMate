import { alertsApi } from '@/lib/api';
import { isPlaygroundMode } from '@/lib/playground';
import { generateDiverseMockAlerts } from '@/mocks/mockAlerts.utils';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useAlerts = () => {
	const useMock = isPlaygroundMode();

	return useQuery({
		queryKey: [...queryKeys.alerts, useMock ? 'mock' : 'api'],
		queryFn: async () => {
			if (useMock) {
				return generateDiverseMockAlerts(5000);
			}

			const response = await alertsApi.getAllAlerts();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch alerts');
			}
			return response.data?.alerts || [];
		},
		staleTime: 5 * 1000,
		refetchInterval: useMock ? false : 5 * 1000,
	});
};
