import { AlertCallbackPayload, callbacksApi } from '@/lib/api';
import { AlertCallback } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useCreateCallback = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (payload: AlertCallbackPayload): Promise<AlertCallback> => {
			const response = await callbacksApi.createCallback(payload);
			if (!response.success || !response.data) throw new Error(response.error || 'Failed to create callback');
			return response.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.callbacks }),
	});
};
