import { Alert } from '@OpsiMate/shared';
import { QueryClient, QueryKey } from '@tanstack/react-query';

// Optimistic updates for one alert across every cached alert list. The lists are keyed
// [...prefix, mode, query] (one entry per filter/sort combination), so a write to the bare
// prefix key reaches none of them: prefix-matching setQueriesData is the only way in. The
// prefix also matches queries of OTHER shapes (facets objects, match counts, analytics,
// group summaries), so the updaters below never assume a shape: they rewrite the infinite
// list ({pages: [{alerts}]}) and a plain Alert[], and return anything else untouched. An
// updater that throws is worse than none: a throw in onMutate makes react-query skip
// mutationFn, so the server is never told.

// A page of the useAlerts/useResolvedAlerts infinite query, as far as these updaters need to know it.
interface AlertsPageLike {
	alerts?: Alert[];
	total?: number;
}
interface InfiniteAlertsLike {
	pages: AlertsPageLike[];
}

export type AlertCacheSnapshot = [QueryKey, unknown][];

const hasPages = (value: object): value is InfiniteAlertsLike => Array.isArray((value as InfiniteAlertsLike).pages);

// Replaces the alert with this id wherever a list holds it.
export const updateAlertInCache =
	(alertId: string, change: (alert: Alert) => Alert) =>
	(old: unknown): unknown => {
		if (!old || typeof old !== 'object') return old;
		const apply = (alert: Alert): Alert => (alert?.id === alertId ? change(alert) : alert);
		if (Array.isArray(old)) return (old as Alert[]).map(apply);
		if (hasPages(old)) {
			return {
				...old,
				pages: old.pages.map((page) =>
					page && Array.isArray(page.alerts) ? { ...page, alerts: page.alerts.map(apply) } : page
				),
			};
		}
		return old;
	};

// Drops the alert with this id from every list, and takes it off the list's total.
export const removeAlertFromCache =
	(alertId: string) =>
	(old: unknown): unknown => {
		if (!old || typeof old !== 'object') return old;
		const keep = (alert: Alert): boolean => alert?.id !== alertId;
		if (Array.isArray(old)) return (old as Alert[]).filter(keep);
		if (hasPages(old)) {
			let removed = false;
			const pages = old.pages.map((page) => {
				if (!page || !Array.isArray(page.alerts)) return page;
				const alerts = page.alerts.filter(keep);
				if (alerts.length === page.alerts.length) return page;
				removed = true;
				return { ...page, alerts };
			});
			// The server's filtered total lives on the first page.
			const first = pages[0];
			if (removed && first && typeof first.total === 'number') {
				pages[0] = { ...first, total: Math.max(0, first.total - 1) };
			}
			return removed ? { ...old, pages } : old;
		}
		return old;
	};

// Cancels in-flight fetches under the prefix (a poll landing after this would overwrite
// the optimistic state), applies the updater to every query under it, and returns what
// was there for restoreAlertCaches to roll back to.
export const applyToAlertCaches = async (
	queryClient: QueryClient,
	prefix: QueryKey,
	updater: (old: unknown) => unknown
): Promise<AlertCacheSnapshot> => {
	await queryClient.cancelQueries({ queryKey: prefix });
	const snapshot = queryClient.getQueriesData({ queryKey: prefix });
	queryClient.setQueriesData({ queryKey: prefix }, updater);
	return snapshot;
};

export const restoreAlertCaches = (queryClient: QueryClient, snapshot: AlertCacheSnapshot | undefined): void => {
	for (const [key, data] of snapshot ?? []) {
		queryClient.setQueryData(key, data);
	}
};
