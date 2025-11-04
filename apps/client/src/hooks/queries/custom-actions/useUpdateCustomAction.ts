import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customActionsApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';
import { CustomAction } from '@OpsiMate/custom-actions';

export const useUpdateCustomAction = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ actionId, action }: { actionId: number; action: CustomAction }) => {
			const response = await customActionsApi.updateAction(actionId, action);
			if (!response.success) {
				throw new Error(response.error || 'Failed to update custom action');
			}
			return response.data;
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.customActions });
			queryClient.invalidateQueries({ queryKey: queryKeys.customAction(variables.actionId) });
		},
	});
};
