import { queryKeys } from '@/hooks/queries/queryKeys';
import { alertsApi } from '@/lib/api';
import { AlertHistory, AlertHistoryData } from '@OpsiMate/shared';
import { useQueries } from '@tanstack/react-query';

// The merged history of every member of an incident, one timeline, newest first.
// Fetches one history per member through the SAME query keys the alert details panel
// uses, so a mutation invalidating a member's history refreshes this view too.
//
// Merged and sorted inline on each render — a handful of member histories is a few
// hundred entries at worst, far below memoization territory (and useQueries hands back
// fresh array identities every render anyway, which defeats naive memo deps).
//
// Deferral is the CALLER's job: this hook fires N requests on mount, so it lives in a
// component that only mounts once the History section is opened.
export const useMergedIncidentHistory = (alertIds: string[]): AlertHistoryData[] => {
	const results = useQueries({
		queries: alertIds.map((alertId) => ({
			queryKey: queryKeys.alertHistory(alertId),
			queryFn: async (): Promise<AlertHistory | null> => {
				const response = await alertsApi.getAlertHistory(alertId);
				if (!response.success) throw new Error(response.error || 'Failed to fetch history');
				return response.data ?? null;
			},
		})),
	});
	const merged: AlertHistoryData[] = [];
	for (const result of results) {
		if (result.data) merged.push(...result.data.data);
	}
	return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
