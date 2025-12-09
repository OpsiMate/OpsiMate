import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { dashboardsApi } from './dashboards.api';

export const useDeleteDashboard = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await dashboardsApi.deleteDashboard(id);
            if (!response.success) {
                throw new Error(response.error || 'Failed to delete dashboard');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboards });
        },
    });
};
