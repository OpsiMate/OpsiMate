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

// One filter value the user added on top of whatever the dashboard was saved with.
export interface AddedFilterValue {
	// Raw filter key, '!'-prefixed for exclusions.
	key: string;
	// The key without the '!' prefix — what the label lookup uses.
	field: string;
	value: string;
	excluded: boolean;
}

// Filter values present in `current` but not in `saved`. The point is that a dashboard
// legitimately CARRIES filters — those are the view the user opened on purpose and are
// already described by the sidebar — so only the delta is worth announcing. A dashboard
// with no saved filters (a fresh draft) has an empty `saved`, which makes every active
// filter part of the delta, exactly as intended.
export const diffAddedFilters = (
	current: Record<string, string[]> | undefined,
	saved: Record<string, string[]> | undefined
): AddedFilterValue[] => {
	const added: AddedFilterValue[] = [];
	for (const [key, values] of Object.entries(current ?? {})) {
		const savedValues = new Set(saved?.[key] ?? []);
		const excluded = key.startsWith('!');
		for (const value of values ?? []) {
			if (savedValues.has(value)) continue;
			added.push({ key, field: excluded ? key.slice(1) : key, value, excluded });
		}
	}
	return added;
};
