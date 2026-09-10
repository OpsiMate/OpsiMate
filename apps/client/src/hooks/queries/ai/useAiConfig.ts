import { aiApi } from '@/lib/api';
import { AiConfig } from '@OpsiMate/shared';
import { useQuery } from '@tanstack/react-query';
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
