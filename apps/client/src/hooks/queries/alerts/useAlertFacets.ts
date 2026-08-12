import { alertsApi, AlertFacetsOptions, AlertFacetsResponse } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

// Faceted sidebar counts, tag keys and the silenced total, computed server-side over
// the RAW dataset — the sidebar describes what filters WOULD show, so it must not be
// limited to the filtered page the table loaded. The playground serves this from a
// mock handler over the same shared engine.
export const useAlertFacets = (filters: Record<string, string[]>, options?: AlertFacetsOptions) => {
	return useQuery<AlertFacetsResponse>({
		queryKey: [...queryKeys.alerts, 'facets', options?.resolved ? 'resolved' : 'active', filters],
		queryFn: async () => {
			const response = await alertsApi.getAlertFacets(filters, options);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to fetch alert facets');
			}
			return response.data;
		},
		staleTime: 5 * 1000,
		refetchInterval: 10 * 1000,
	});
};
