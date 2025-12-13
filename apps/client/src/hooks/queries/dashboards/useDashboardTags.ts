import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardsApi } from './dashboards.api';
import { queryKeys } from '../queryKeys';

export const useGetAllDashboardTags = () => {
	return useQuery({
		queryKey: queryKeys.dashboardTags,
		queryFn: async () => {
			const response = await dashboardsApi.getAllDashboardTags();
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to fetch dashboard tags');
			}
			return response.data;
		},
	});
};

export const useAddTagToDashboard = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ dashboardId, tagId }: { dashboardId: string; tagId: number }) => {
			const response = await dashboardsApi.addTagToDashboard(dashboardId, tagId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to add tag to dashboard');
			}
			return response;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.dashboardTags });
			queryClient.invalidateQueries({ queryKey: queryKeys.dashboards });
		},
	});
};

export const useRemoveTagFromDashboard = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ dashboardId, tagId }: { dashboardId: string; tagId: number }) => {
			const response = await dashboardsApi.removeTagFromDashboard(dashboardId, tagId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to remove tag from dashboard');
			}
			return response;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.dashboardTags });
			queryClient.invalidateQueries({ queryKey: queryKeys.dashboards });
		},
	});
};

