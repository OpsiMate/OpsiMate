import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customActionsApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';
import { CustomAction } from '@OpsiMate/custom-actions';

export const useCreateCustomAction = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (action: CustomAction) => {
			const response = await customActionsApi.createAction(action);
			if (!response.success) {
				throw new Error(response.error || 'Failed to create custom action');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.customActions });
		},
	});
};
