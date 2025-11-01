import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customActionsApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useDeleteCustomAction = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (actionId: number) => {
			const response = await customActionsApi.deleteAction(actionId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to delete custom action');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.customActions });
		},
	});
};
