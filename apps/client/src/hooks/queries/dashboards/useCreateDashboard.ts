import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { dashboardsApi } from './dashboards.api';
import { CreateDashboardInput } from './dashboards.types';

export const useCreateDashboard = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: CreateDashboardInput) => {
			const response = await dashboardsApi.createDashboard(data);
			if (!response.success) {
				throw new Error(response.error || 'Failed to create dashboard');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.dashboards });
		},
	});
};
