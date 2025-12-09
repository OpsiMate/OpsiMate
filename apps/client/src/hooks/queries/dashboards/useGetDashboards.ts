import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { dashboardsApi } from './dashboards.api';

export const useGetDashboards = () => {
	return useQuery({
		queryKey: queryKeys.dashboards,
		queryFn: async () => {
			const response = await dashboardsApi.getAllDashboards();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch dashboards');
			}
			return response.data || [];
		},
	});
};
