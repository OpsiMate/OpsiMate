import { Alert, AlertGroupSummaryNode, AlertOwnerInfo, getOwnerDisplayName, groupKeySegment } from '@OpsiMate/shared';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { UserInfo } from '../users/useUsers';
import type { AlertCacheSnapshot } from './alertListCache';

// The split-by-owner pane counts (and group-by-owner headers) read the server's owner
// group summaries, a query of their own. The rows move the moment an optimistic update
// paints them, so the counts must move with them — or the headers lag the rows by a
// round-trip and a refetch, which reads as the counts being wrong.

// An alert's owner before and after an optimistic update. `to` is undefined when the
// update took the alert out of the lists (resolved, deleted).
export interface OwnerMove {
	from: string | null;
	to: string | null | undefined;
}

interface AlertsPageLike {
	alerts?: Alert[];
}

interface InfiniteAlertsLike {
	pages: AlertsPageLike[];
}

// The alerts a cached list holds, whatever its shape; null for caches that are not lists.
const listAlerts = (data: unknown): Alert[] | null => {
	if (!data || typeof data !== 'object') return null;
	if (Array.isArray(data)) return data as Alert[];
	const pages = (data as InfiniteAlertsLike).pages;
	if (!Array.isArray(pages)) return null;
	return pages.flatMap((page) => (page && Array.isArray(page.alerts) ? page.alerts : []));
};

// The owner moves one cached list shows between its current alerts and the updater's
// result; alerts already seen in another list are skipped.
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

// What an updater does to owners, read off the lists it is about to change: each alert
// once (the same alert sits in several lists, one per filter/sort combination).
export const ownerMovesBetween = (
	snapshot: AlertCacheSnapshot,
	updater: (old: unknown) => unknown
): Map<string, OwnerMove> => {
	const moves = new Map<string, OwnerMove>();
	const seen = new Set<string>();
	for (const [, data] of snapshot) collectOwnerMoves(data, updater, seen, moves);
	return moves;
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

// The active owner summaries (useAlertGroupSummaries keyed [...alerts, 'groups',
// 'active', groupBy, ...]) whose top-level grouping is by owner.
const isActiveOwnerSummariesKey = (key: readonly unknown[]): boolean => {
	const groupBy = key[3];
	return key[1] === 'groups' && key[2] === 'active' && Array.isArray(groupBy) && groupBy[0] === 'owner';
};

// Paints the moves onto every cached active owner summary. Display names come from the
// cached users list, the same way the server labels its buckets; an owner it does not
// know gets the server's own fallback label.
export const applyOwnerMovesToSummaries = (queryClient: QueryClient, moves: Map<string, OwnerMove>): void => {
	if (moves.size === 0) return;
	const users = queryClient.getQueryData<UserInfo[]>(queryKeys.users) ?? [];
	const owners: AlertOwnerInfo[] = users.map((user) => ({ id: String(user.id), fullName: user.fullName }));
	const nameOf = (ownerId: string | null) => getOwnerDisplayName(ownerId, owners);
	for (const [key, data] of queryClient.getQueriesData({ queryKey: [...queryKeys.alerts, 'groups', 'active'] })) {
		if (!isActiveOwnerSummariesKey(key) || !Array.isArray(data)) continue;
		queryClient.setQueryData(key, shiftOwnerSummaries(data as AlertGroupSummaryNode[], moves.values(), nameOf));
	}
};
