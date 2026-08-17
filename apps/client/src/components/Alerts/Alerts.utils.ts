import { AlertGroupSummaryNode } from '@OpsiMate/shared';

// The split-by-owner pane headers, derived from ONE group-summaries response. Both
// numbers coming from a single server snapshot is the point: two independent count
// queries answered at different moments could disagree with each other (and with the
// list total), which read as "Unassigned 42 + Assigned 0 while Active says 41".
export interface OwnerPaneCounts {
	unassigned: number;
	assigned: number;
}

// 'Unassigned' is the engine's display value for ownerless alerts (getOwnerDisplayName);
// every other top-level owner bucket is a real assignee.
export const splitOwnerPaneCounts = (nodes: AlertGroupSummaryNode[] | undefined): OwnerPaneCounts | undefined => {
	if (!nodes) return undefined;
	let unassigned = 0;
	let assigned = 0;
	for (const node of nodes) {
		if (node.value === 'Unassigned') {
			unassigned += node.count;
		} else {
			assigned += node.count;
		}
	}
	return { unassigned, assigned };
};

// One filter value that differs from the saved dashboard, in either direction.
export type FilterChangeDirection = 'added' | 'removed';

export interface FilterChange {
	// Raw filter key, '!'-prefixed for exclusions.
	key: string;
	// The key without the '!' prefix — what the label lookup uses.
	field: string;
	value: string;
	excluded: boolean;
	direction: FilterChangeDirection;
}

// Every difference between the current filter record and the dashboard's saved one.
// Both directions matter: removing a filter the dashboard was saved with widens the
// view just as invisibly as adding one narrows it, and the user is equally entitled to
// know their view no longer matches what they saved. A dashboard with no saved filters
// (a fresh draft) has an empty `saved`, so every active filter reads as added.
export const diffFilterChanges = (
	current: Record<string, string[]> | undefined,
	saved: Record<string, string[]> | undefined
): FilterChange[] => {
	const changes: FilterChange[] = [];
	const describe = (key: string, value: string, direction: FilterChangeDirection): FilterChange => {
		const excluded = key.startsWith('!');
		return { key, field: excluded ? key.slice(1) : key, value, excluded, direction };
	};

	for (const [key, values] of Object.entries(current ?? {})) {
		const savedValues = new Set(saved?.[key] ?? []);
		for (const value of values ?? []) {
			if (!savedValues.has(value)) changes.push(describe(key, value, 'added'));
		}
	}
	for (const [key, values] of Object.entries(saved ?? {})) {
		const currentValues = new Set(current?.[key] ?? []);
		for (const value of values ?? []) {
			if (!currentValues.has(value)) changes.push(describe(key, value, 'removed'));
		}
	}
	return changes;
};
