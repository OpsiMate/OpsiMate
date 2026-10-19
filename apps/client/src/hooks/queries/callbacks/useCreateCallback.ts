import { AlertCallbackInput, callbacksApi } from '@/lib/api';
import { AlertCallbackWithSecret } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useCreateCallback = () => {
	const queryClient = useQueryClient();
	return useMutation({
		// The response is the one time the generated secret is shown.
		mutationFn: async (payload: AlertCallbackInput): Promise<AlertCallbackWithSecret> => {
			const response = await callbacksApi.createCallback(payload);
			if (!response.success || !response.data) throw new Error(response.error || 'Failed to create callback');
			return response.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.callbacks }),
	});
};
