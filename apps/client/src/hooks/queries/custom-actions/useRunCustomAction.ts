import { customActionsApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useRunCustomActionForService = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ serviceId, actionId }: { serviceId: number; actionId: number }) => {
			const response = await customActionsApi.runForService(serviceId, actionId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to run custom action');
			}
			return response.data;
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.services });
			queryClient.invalidateQueries({ queryKey: queryKeys.service(variables.serviceId) });
		},
	});
};

export const useRunCustomActionForProvider = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ providerId, actionId }: { providerId: number; actionId: number }) => {
			const response = await customActionsApi.runForProvider(providerId, actionId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to run custom action');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.providers });
			queryClient.invalidateQueries({ queryKey: queryKeys.services });
		},
	});
};
