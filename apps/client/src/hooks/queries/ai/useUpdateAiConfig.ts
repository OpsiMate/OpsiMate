import { aiApi } from '@/lib/api';
import { AiConfig, UpdateAiConfig } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useUpdateAiConfig = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (updates: UpdateAiConfig): Promise<AiConfig> => {
			const response = await aiApi.updateConfig(updates);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to update AI settings');
			}
			return response.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ai }),
	});
};
