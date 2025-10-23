import { useMutation, useQueryClient } from '@tanstack/react-query';
import { providerApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useStopService = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (serviceId: number) => {
			const response = await providerApi.stopService(serviceId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to stop service');
			}
			return response.data;
		},
		onSuccess: (data, serviceId) => {
			// Invalidate and refetch services
			queryClient.invalidateQueries({ queryKey: queryKeys.services });
			queryClient.invalidateQueries({ queryKey: queryKeys.service(serviceId) });
		},
	});
};
