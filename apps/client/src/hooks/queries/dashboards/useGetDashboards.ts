import { apiRequest } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

// Define the Dashboard interface (if not already defined elsewhere)
export interface Dashboard {
    id: string;
    name: string;
    description: string;
    // Add other properties as needed from the API response
}

export const dashboardsApi = {
    getAllDashboards: () => {
        return apiRequest<Dashboard[]>('/dashboards');
    },
};

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
