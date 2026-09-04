import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { rootCauseApi } from './rootCause.api';

// Fetched when the drawer section mounts for one alert — the on-demand read that
// keeps root causes out of the polled list payloads entirely. No refetch interval:
// an analysis changes when the sender re-pushes, which a drawer re-open picks up.
export const useAlertRootCause = (alertId: string) => {
	return useQuery({
		queryKey: queryKeys.alertRootCause(alertId),
		queryFn: async () => {
			const response = await rootCauseApi.getByAlertId(alertId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch root cause');
			}
			return response.data?.rootCause ?? null;
		},
		enabled: alertId.length > 0,
		// Fresh on every drawer open (a sender may have re-pushed), while the 30s
		// staleTime still dedupes fetches within one mounted drawer.
		staleTime: 30 * 1000,
		refetchOnMount: 'always',
	});
};
