import { AlertCallbackInput, AlertCallbackUpdated, callbacksApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export interface UpdateCallbackInput {
	id: number;
	// Partial: the list's on/off switch sends { enabled } alone.
	payload: Partial<AlertCallbackInput>;
}

export const useUpdateCallback = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, payload }: UpdateCallbackInput): Promise<AlertCallbackUpdated> => {
			const response = await callbacksApi.updateCallback(id, payload);
			if (!response.success || !response.data) throw new Error(response.error || 'Failed to update callback');
			return response.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.callbacks }),
	});
};
