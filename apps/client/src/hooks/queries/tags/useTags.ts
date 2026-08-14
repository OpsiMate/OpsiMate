import { useQuery } from '@tanstack/react-query';
import { tagApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useTags = () => {
	return useQuery({
		queryKey: queryKeys.tags,
		queryFn: async () => {
			const response = await tagApi.getAllTags();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch tags');
			}
			return response.data || [];
		},
	});
};
