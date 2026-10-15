import { alertsApi } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { Alert, AlertBulkActionRequest } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
	AlertCacheSnapshot,
	applyToAlertCaches,
	removeAlertsFromCache,
	restoreAlertCaches,
	updateAlertsInCache,
} from './alertListCache';

// What the server does to each selected alert, applied to the cached active lists so the
// rows change on click (see alertListCache). Only an explicit id selection can be applied
// here: an "all matching" query is resolved server-side against alerts the client may
// never have loaded, so that scope waits for the refetch. The server acts on active
// alerts only (the selection bar lives on the Active tab), hence only the alerts prefix.
const optimisticUpdate = (variables: AlertBulkActionRequest): ((old: unknown) => unknown) | null => {
	if (!variables.ids || variables.ids.length === 0) return null;
	const ids = new Set(variables.ids);
	switch (variables.action) {
		case 'assignOwner':
			return updateAlertsInCache(ids, (alert) => ({ ...alert, ownerId: variables.ownerId ?? null }));
		case 'silence': {
			// Silencing also hands the alert to whoever silenced it (AlertBL.silenceAlert).
			const actorId = getCurrentUser()?.id;
			return updateAlertsInCache(ids, (alert): Alert => ({
				...alert,
				isSilenced: true,
				silencedUntil: variables.silencedUntil ?? null,
				...(actorId != null ? { ownerId: String(actorId) } : {}),
			}));
		}
		case 'unsilence':
			return updateAlertsInCache(ids, (alert) => ({ ...alert, isSilenced: false, silencedUntil: null }));
		case 'resolve':
			return removeAlertsFromCache(ids);
		case 'comment':
			return null;
	}
};

interface BulkAlertActionContext {
	previous: AlertCacheSnapshot | null;
}

// One request for a whole bulk action instead of a fan-out of per-alert calls. The
// result carries how many alerts matched and how many succeeded, so callers can toast
// an honest count.
export const useBulkAlertAction = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: queryKeys.bulkAlertAction,
		mutationFn: async (variables: AlertBulkActionRequest) => {
			const response = await alertsApi.bulkAlertAction(variables);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Bulk alert action failed');
			}
			return response.data;
		},
		onMutate: async (variables: AlertBulkActionRequest): Promise<BulkAlertActionContext> => {
			const update = optimisticUpdate(variables);
			if (!update) return { previous: null };
			return { previous: await applyToAlertCaches(queryClient, queryKeys.alerts, update) };
		},
		onError: (_err, _variables, context) => {
			restoreAlertCaches(queryClient, context?.previous ?? undefined);
		},
		onSettled: () => {
			// Every bulk action changes list membership, counts, or row fields — refresh
			// the active lists and everything derived from them (facets, group summaries),
			// the resolved list (bulk resolve moves rows there; it lives under its own
			// root key), and the per-alert history/comment panels, which have no poll of
			// their own and would otherwise show stale content if one of the targets is
			// open in the details panel. On success this also reconciles a partial result
			// (alerts the server skipped) with the optimistic state; on failure it follows
			// the rollback.
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
			queryClient.invalidateQueries({ queryKey: queryKeys.resolvedAlerts });
			queryClient.invalidateQueries({ queryKey: queryKeys.alertComments });
			queryClient.invalidateQueries({ queryKey: queryKeys.alertHistoryAll });
		},
	});
};
