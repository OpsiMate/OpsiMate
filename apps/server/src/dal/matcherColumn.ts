import { getLabelMatcherGroups, LabelMatcherGroups, MutePolicyLabelMatcher } from '@OpsiMate/shared';

// The label_matchers columns hold either a legacy FLAT matcher list or OR GROUPS (an
// array of arrays). A single group serializes flat, so rows written by this version
// stay readable by older code as long as no OR group is actually used.
export const parseMatcherColumn = (
	raw: string | null
): { labelMatchers: MutePolicyLabelMatcher[]; labelMatcherGroups: LabelMatcherGroups } => {
	if (!raw) return { labelMatchers: [], labelMatcherGroups: [] };
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed) || parsed.length === 0) return { labelMatchers: [], labelMatcherGroups: [] };
		if (Array.isArray(parsed[0])) {
			const groups = parsed as LabelMatcherGroups;
			// labelMatchers mirrors the first group so legacy consumers see SOMETHING
			// sensible; the groups field is the source of truth.
			return { labelMatchers: groups[0] ?? [], labelMatcherGroups: groups };
		}
		const flat = parsed as MutePolicyLabelMatcher[];
		return { labelMatchers: flat, labelMatcherGroups: [flat] };
	} catch {
		return { labelMatchers: [], labelMatcherGroups: [] };
	}
};

export const serializeMatcherColumn = (criteria: {
	labelMatchers?: MutePolicyLabelMatcher[] | null;
	labelMatcherGroups?: LabelMatcherGroups | null;
}): string => {
	const groups = getLabelMatcherGroups(criteria);
	if (groups.length === 0) return JSON.stringify([]);
	if (groups.length === 1) return JSON.stringify(groups[0]);
	return JSON.stringify(groups);
};
