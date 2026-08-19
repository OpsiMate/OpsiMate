import { aiApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

// Whether AI features are usable at all — readable by every authenticated user, cached
// long: it only changes when an admin edits settings.
export const useAiStatus = () => {
	return useQuery({
		queryKey: [...queryKeys.ai, 'status'],
		queryFn: async () => {
			const response = await aiApi.getStatus();
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to fetch AI status');
			}
			return response.data;
		},
		staleTime: 60 * 1000,
	});
};
