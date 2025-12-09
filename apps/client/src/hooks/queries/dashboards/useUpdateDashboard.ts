import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { dashboardsApi } from './dashboards.api';
import { UpdateDashboardInput } from './dashboards.types';

export const useUpdateDashboard = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...data }: UpdateDashboardInput) => {
            const response = await dashboardsApi.updateDashboard(id, data);
            if (!response.success) {
                throw new Error(response.error || 'Failed to update dashboard');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboards });
        },
    });
};
