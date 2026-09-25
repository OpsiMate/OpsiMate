import { enrichmentsApi } from '@/lib/api';
import { AlertEnrichmentVersion } from '@OpsiMate/shared';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useEnrichmentHistory = (id: number | null) => {
	return useQuery({
		queryKey: id === null ? ['enrichments', 'history', 'closed'] : queryKeys.enrichmentHistory(id),
		queryFn: async (): Promise<AlertEnrichmentVersion[]> => {
			const response = await enrichmentsApi.getEnrichmentHistory(id!);
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch enrichment history');
			}
			return response.data || [];
		},
		enabled: id !== null,
	});
};
