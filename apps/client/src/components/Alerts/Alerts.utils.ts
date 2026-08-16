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
