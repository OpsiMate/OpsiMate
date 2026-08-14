import { aiApi } from '@/lib/api';
import { AiConfig, AiTestResult, UpdateAiConfig } from '@OpsiMate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useAiConfig = () => {
	return useQuery({
		queryKey: queryKeys.ai,
		queryFn: async (): Promise<AiConfig> => {
			const response = await aiApi.getConfig();
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to fetch AI settings');
			}
			return response.data;
		},
	});
};

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

// Fires one real (tiny) Bedrock call with the SAVED configuration and returns the
// outcome — save first, then test, so what was verified is what is stored.
export const useTestAiConnection = () => {
	return useMutation({
		mutationFn: async (): Promise<AiTestResult> => {
			const response = await aiApi.testConnection();
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to run the connection test');
			}
			return response.data;
		},
	});
};
