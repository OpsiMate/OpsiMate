import { alertsApi, AlertQueryParams } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

// How many active alerts match a query — the N in "Select all N matching". A limit-1
// list request whose response carries the true total, so the count comes from the same
// server engine that will resolve the bulk action; the one row in the payload is noise.
// Only fetched while a selection is open (see `enabled`), so it costs nothing otherwise.
export const useAlertMatchCount = (
	params: Pick<AlertQueryParams, 'filters' | 'from' | 'to' | 'search'>,
	enabled: boolean
) => {
	const { data } = useQuery({
		queryKey: [
			...queryKeys.alerts,
			'matchCount',
			params.filters ?? null,
			params.from ?? null,
			params.to ?? null,
			params.search ?? null,
		],
		enabled,
		queryFn: async () => {
			const response = await alertsApi.getAllAlerts({ ...params, limit: 1 });
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to count matching alerts');
			}
			return response.data.total ?? response.data.alerts.length;
		},
		staleTime: 10 * 1000,
		refetchInterval: 20 * 1000,
	});
	return data;
};
