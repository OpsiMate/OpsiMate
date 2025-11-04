import { useQuery } from '@tanstack/react-query';
import { viewsApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useViews = () => {
	return useQuery({
		queryKey: queryKeys.views,
		queryFn: async () => {
			const response = await viewsApi.getViews();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch views');
			}
			return response.data || [];
		},
	});
};
