import { Alert, AlertGroupSummaryNode, AlertOwnerInfo, getOwnerDisplayName, groupKeySegment } from '@OpsiMate/shared';
import { QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { UserInfo } from '../users/useUsers';
import type { AlertCacheSnapshot } from './alertListCache';

// The split-by-owner pane counts read the server's owner group summaries, a query of
// their own. The rows move the moment an optimistic update paints them, so the counts
// must move with them — or the badges lag the rows by a round-trip and a refetch, which
// reads as the counts being wrong.

// An alert's owner before and after an optimistic update. `to` is undefined when the
// update took the alert out of the lists (resolved, deleted).
export interface OwnerMove {
	from: string | null;
	to: string | null | undefined;
}

// Moves grouped by the scope (filters, time window, search) of the list they were read
// from — a summary is only shifted by moves of alerts it counts.
export type OwnerMovesByScope = Map<string, Map<string, OwnerMove>>;

interface AlertsPageLike {
	alerts?: Alert[];
}

interface InfiniteAlertsLike {
	pages: AlertsPageLike[];
}

// The query parameters that decide which alerts a list or a summary covers.
interface ScopeParams {
	filters?: Record<string, string[]> | null;
	from?: string | null;
	to?: string | null;
	search?: string | null;
}

const canonical = (value: unknown): string =>
	JSON.stringify(value, (_key, v: unknown) =>
		v && typeof v === 'object' && !Array.isArray(v)
			? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
			: v
	);

const scopeKey = (params: ScopeParams | null | undefined): string =>
	canonical([params?.filters ?? null, params?.from ?? null, params?.to ?? null, params?.search ?? null]);

// Active list caches are keyed [...alerts, 'api' | 'playground', query] (see useAlerts).
const listScope = (key: QueryKey): string | null =>
	key[0] === queryKeys.alerts[0] && (key[1] === 'api' || key[1] === 'playground')
		? scopeKey(key[2] as ScopeParams | null)
		: null;

// Active owner summaries are keyed [...alerts, 'groups', 'active', groupBy, filters,
// from, to, search] (see useAlertGroupSummaries). Only the flat owner grouping is
// shifted: a nested one would need its children and rollup status recomputed too, and
// nothing reads it for the panes — it waits for the refetch.
const ownerSummaryScope = (key: QueryKey): string | null => {
	const groupBy = key[3];
	if (key[1] !== 'groups' || key[2] !== 'active' || !Array.isArray(groupBy)) return null;
	if (groupBy.length !== 1 || groupBy[0] !== 'owner') return null;
	return scopeKey({
		filters: key[4] as ScopeParams['filters'],
		from: key[5] as string | null,
		to: key[6] as string | null,
		search: key[7] as string | null,
	});
};

const listAlerts = (data: unknown): Alert[] | null => {
	if (!data || typeof data !== 'object') return null;
	if (Array.isArray(data)) return data as Alert[];
	const pages = (data as InfiniteAlertsLike).pages;
	if (!Array.isArray(pages)) return null;
	return pages.flatMap((page) => (page && Array.isArray(page.alerts) ? page.alerts : []));
};

// The owner moves one cached list shows between its current alerts and the updater's
// result; alerts already seen in another list of the same scope are skipped.
const collectOwnerMoves = (
	data: unknown,
	updater: (old: unknown) => unknown,
	seen: Set<string>,
	moves: Map<string, OwnerMove>
): void => {
	const before = listAlerts(data);
	if (!before) return;
	const after = new Map((listAlerts(updater(data)) ?? []).map((alert) => [alert.id, alert]));
	for (const alert of before) {
		if (!alert || seen.has(alert.id)) continue;
		seen.add(alert.id);
		const next = after.get(alert.id);
		const from = alert.ownerId ?? null;
		const to = next ? (next.ownerId ?? null) : undefined;
		if (from !== to) moves.set(alert.id, { from, to });
	}
};

// What an updater does to owners, read off the active lists it is about to change: each
// alert once per scope (the same alert sits in several lists — one per sort — of a scope).
export const ownerMovesBetween = (
	snapshot: AlertCacheSnapshot,
	updater: (old: unknown) => unknown
): OwnerMovesByScope => {
	const byScope: OwnerMovesByScope = new Map();
	const seenByScope = new Map<string, Set<string>>();
	for (const [key, data] of snapshot) {
		const scope = listScope(key);
		if (scope === null) continue;
		const moves = byScope.get(scope) ?? new Map<string, OwnerMove>();
		const seen = seenByScope.get(scope) ?? new Set<string>();
		collectOwnerMoves(data, updater, seen, moves);
		byScope.set(scope, moves);
		seenByScope.set(scope, seen);
	}
	return byScope;
};

const ROOT_KEY = 'root';

// Owner summary nodes with the moves applied: counts shift between the owners' buckets
// (keyed by display name, like the server's), an owner that gains its first alert gets
// a bucket, one that loses its last loses it.
export const shiftOwnerSummaries = (
	nodes: AlertGroupSummaryNode[],
	moves: Iterable<OwnerMove>,
	nameOf: (ownerId: string | null) => string
): AlertGroupSummaryNode[] => {
	const delta = new Map<string, number>();
	const bump = (value: string, by: number) => delta.set(value, (delta.get(value) ?? 0) + by);
	for (const move of moves) {
		bump(nameOf(move.from), -1);
		if (move.to !== undefined) bump(nameOf(move.to), 1);
	}
	if ([...delta.values()].every((by) => by === 0)) return nodes;
	const shifted = nodes
		.map((node) => {
			const by = delta.get(node.value);
			if (by === undefined) return node;
			delta.delete(node.value);
			return { ...node, count: Math.max(0, node.count + by) };
		})
		.filter((node) => node.count > 0);
	for (const [value, by] of delta) {
		if (by <= 0) continue;
		shifted.push({
			key: groupKeySegment(ROOT_KEY, value),
			field: 'owner',
			value,
			count: by,
			status: 'firing',
			level: 0,
			children: [],
		});
	}
	return shifted;
};

// Paints each scope's moves onto the cached active owner summaries of that same scope.
// Display names come from the cached users list, the same way the server labels its
// buckets; an owner it does not know gets the server's own fallback label.
export const applyOwnerMovesToSummaries = (queryClient: QueryClient, movesByScope: OwnerMovesByScope): void => {
	if ([...movesByScope.values()].every((moves) => moves.size === 0)) return;
	const users = queryClient.getQueryData<UserInfo[]>(queryKeys.users) ?? [];
	const owners: AlertOwnerInfo[] = users.map((user) => ({ id: String(user.id), fullName: user.fullName }));
	const nameOf = (ownerId: string | null) => getOwnerDisplayName(ownerId, owners);
	for (const [key, data] of queryClient.getQueriesData({ queryKey: [...queryKeys.alerts, 'groups', 'active'] })) {
		const scope = ownerSummaryScope(key);
		const moves = scope === null ? undefined : movesByScope.get(scope);
		if (!moves || moves.size === 0 || !Array.isArray(data)) continue;
		queryClient.setQueryData(key, shiftOwnerSummaries(data as AlertGroupSummaryNode[], moves.values(), nameOf));
	}
};
