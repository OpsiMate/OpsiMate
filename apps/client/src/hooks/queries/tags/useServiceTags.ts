import { useQuery } from '@tanstack/react-query';
import { tagApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useServiceTags = (id: number) => {
	return useQuery({
		queryKey: queryKeys.serviceTags(id),
		queryFn: async () => {
			const response = await tagApi.getServiceTags(id);
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch service tags');
			}
			return response.data || [];
		},
		enabled: !!id,
	});
};
