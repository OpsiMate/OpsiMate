import { callbacksApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useDeleteCallback = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: number): Promise<void> => {
			const response = await callbacksApi.deleteCallback(id);
			if (!response.success) throw new Error(response.error || 'Failed to delete callback');
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.callbacks }),
	});
};
