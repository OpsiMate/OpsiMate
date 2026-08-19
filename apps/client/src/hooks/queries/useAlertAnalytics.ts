import { alertsApi } from '@/lib/api';
import { AlertAnalytics } from '@OpsiMate/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export interface AnalyticsScope {
	// A dashboard's saved filters + free-text query; both empty = all alerts.
	filters?: Record<string, string[]>;
	search?: string;
	// Tag key to research; the response then carries the tagInsights section.
	tagKey?: string;
}

// The Insights page's single data source. Keyed by the window AND the scope so
// switching presets/dashboards caches each; keepPreviousData holds the charts steady
// while a new combination loads instead of collapsing the page to a spinner.
export const useAlertAnalytics = (from: string | null, scope?: AnalyticsScope) => {
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return useQuery({
		queryKey: [
			...queryKeys.alerts,
			'analytics',
			from,
			timeZone,
			scope?.filters ?? null,
			scope?.search ?? null,
			scope?.tagKey ?? null,
		],
		queryFn: async (): Promise<AlertAnalytics> => {
			const response = await alertsApi.getAlertAnalytics(
				from,
				timeZone,
				scope?.filters,
				scope?.search,
				scope?.tagKey
			);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to fetch analytics');
			}
			return response.data;
		},
		staleTime: 30 * 1000,
		placeholderData: keepPreviousData,
	});
};
