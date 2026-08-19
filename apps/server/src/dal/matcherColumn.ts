import { getLabelMatcherGroups, getNameNeedles, LabelMatcherGroups, MutePolicyLabelMatcher } from '@OpsiMate/shared';

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

// The name_contains columns hold either a single substring (every row written before
// name matching could be a list) or a JSON array of substrings ORed together. Same
// trade-off the label_matchers column above already makes: a single value serializes as
// the plain string, so rows stay readable by older code unless an OR list is actually
// used.
export const parseNameColumn = (raw: string | null): { nameContains: string | null; nameContainsAny: string[] } => {
	if (!raw) return { nameContains: null, nameContainsAny: [] };
	const trimmed = raw.trim();
	if (!trimmed.startsWith('[')) return { nameContains: raw, nameContainsAny: [raw] };
	try {
		const parsed: unknown = JSON.parse(trimmed);
		if (!Array.isArray(parsed)) return { nameContains: raw, nameContainsAny: [raw] };
		const values = parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
		// nameContains mirrors the first value so a legacy consumer still filters on
		// SOMETHING sensible; the array is the source of truth.
		return { nameContains: values[0] ?? null, nameContainsAny: values };
	} catch {
		// A literal name that merely starts with '[' — treat it as the substring it is.
		return { nameContains: raw, nameContainsAny: [raw] };
	}
};

export const serializeNameColumn = (criteria: {
	nameContains?: string | null;
	nameContainsAny?: string[] | null;
}): string | null => {
	const needles = getNameNeedles(criteria);
	if (needles.length === 0) return null;
	if (needles.length === 1) return needles[0];
	return JSON.stringify(needles);
};
