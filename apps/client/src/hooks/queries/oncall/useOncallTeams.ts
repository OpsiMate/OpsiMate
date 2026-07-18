import { oncallApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useOncallTeams = () => {
	return useQuery({
		queryKey: queryKeys.oncallTeams,
		queryFn: async () => {
			const response = await oncallApi.getTeams();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch on-call teams');
			}
			return response.data?.teams ?? [];
		},
		// The current on-call order is time-derived (rotation), so refresh periodically.
		refetchInterval: 60_000,
	});
};
