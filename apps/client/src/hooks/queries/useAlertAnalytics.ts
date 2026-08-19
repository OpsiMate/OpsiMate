import { alertsApi } from '@/lib/api';
import { AlertAnalytics } from '@OpsiMate/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

// The Insights page's single data source. Keyed by the window so switching presets
// caches each; keepPreviousData holds the charts steady while a new window loads
// instead of collapsing the page to a spinner.
export const useAlertAnalytics = (from: string | null) => {
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return useQuery({
		queryKey: [...queryKeys.alerts, 'analytics', from, timeZone],
		queryFn: async (): Promise<AlertAnalytics> => {
			const response = await alertsApi.getAlertAnalytics(from, timeZone);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to fetch analytics');
			}
			return response.data;
		},
		staleTime: 30 * 1000,
		placeholderData: keepPreviousData,
	});
};
