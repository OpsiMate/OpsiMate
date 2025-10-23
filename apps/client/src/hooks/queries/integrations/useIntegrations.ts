import { useQuery } from '@tanstack/react-query';
import { integrationApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useIntegrations = () => {
	return useQuery({
		queryKey: queryKeys.integrations,
		queryFn: async () => {
			const response = await integrationApi.getIntegrations();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch integrations');
			}
			return response.data?.integrations || [];
		},
	});
};
