import { AlertFacetsResult, BASE_ALERT_FACET_FIELDS, isTagKeyColumn } from '@OpsiMate/shared';

// The vocabulary of the alerts filter record (field -> accepted display values, "!field"
// for exclusion), as the live facets describe it. Shared by everything that accepts a
// filter record from outside the UI: the AI filter-from-text feature (which drops what
// it cannot validate — a hallucinated value must never reach the query engine) and the
// MCP tools (which reject it with the known values, so the caller can correct itself).

// Fields whose values are a fixed enum rather than whatever currently exists: "not
// silenced" must validate even when nothing is silenced right now, and "resolved
// alerts" even when the archive is empty. Everything else (tags, types, owners)
// validates against the live vocabulary only.
export const STATIC_FIELD_VALUES: Record<string, string[]> = {
	status: ['Firing', 'Muted', 'Silenced', 'Resolved'],
	severity: ['Critical', 'Warning', 'Info'],
};

// Values a field accepts right now: the static enum plus whatever the facets carry.
export const knownFilterValues = (field: string, facets: AlertFacetsResult): string[] => [
	...new Set([...(STATIC_FIELD_VALUES[field] ?? []), ...Object.keys(facets.facets[field] ?? {})]),
];

// The grounding sent to the model: every filterable field with its live values (plus
// the static enums above). Values are capped per field to keep the prompt small;
// alertName is deliberately excluded — name matching belongs in `search`, and
// thousands of names would bloat every call.
const VOCAB_VALUE_CAP = 60;
export const buildVocabulary = (facets: AlertFacetsResult): Record<string, string[]> => {
	const vocabulary: Record<string, string[]> = { ...STATIC_FIELD_VALUES };
	for (const [field, counts] of Object.entries(facets.facets)) {
		if (field === 'alertName') continue;
		const merged = new Set([...(vocabulary[field] ?? []), ...Object.keys(counts)]);
		vocabulary[field] = [...merged].slice(0, VOCAB_VALUE_CAP);
	}
	return vocabulary;
};

// Keep only fields that exist and, per field, only values the vocabulary actually
// contains (case-insensitive in, canonical casing out). "!field" exclusion keys
// validate against the same base field.
export const sanitizeFilters = (
	raw: Record<string, unknown> | undefined,
	facets: AlertFacetsResult
): Record<string, string[]> => {
	const result: Record<string, string[]> = {};
	if (!raw) return result;
	for (const [key, values] of Object.entries(raw)) {
		if (!Array.isArray(values)) continue;
		const baseField = key.startsWith('!') ? key.slice(1) : key;
		const knownValues = knownFilterValues(baseField, facets);
		if (knownValues.length === 0 || baseField === 'alertName') continue;
		const canonical = new Map(knownValues.map((v) => [v.toLowerCase(), v]));
		const kept = values
			.filter((v): v is string => typeof v === 'string')
			.map((v) => canonical.get(v.toLowerCase()))
			.filter((v): v is string => v !== undefined);
		if (kept.length > 0) result[key] = [...new Set(kept)];
	}
	return result;
};

export interface ValidFilters {
	ok: true;
	filters: Record<string, string[]>;
}

export interface InvalidFilters {
	ok: false;
	// One sentence per problem, each naming the values (or fields) that would be accepted.
	problems: string[];
}

export type FilterValidation = ValidFilters | InvalidFilters;

// Owner is a live facet, but "Unassigned" is what an alert without an owner presents
// (see getOwnerDisplayName) and must validate even when every alert is owned.
const ALWAYS_KNOWN_VALUES: Record<string, string[]> = {
	owner: ['Unassigned'],
};

const describeValues = (values: string[]): string => values.map((v) => `"${v}"`).join(', ');

// The strict counterpart of sanitizeFilters for callers that can act on an error: every
// field must be a filterable column and every value one the field currently carries
// (matched case-insensitively, returned in canonical casing). Unknown entries are
// reported with what WOULD be accepted rather than dropped, so an assistant can repair
// its call instead of silently getting a wider result. alertName and tag values are free
// text (any value is a legitimate match-nothing filter) and pass through untouched.
export const validateFilters = (raw: Record<string, string[]>, facets: AlertFacetsResult): FilterValidation => {
	const knownFields = new Set<string>([...BASE_ALERT_FACET_FIELDS, ...Object.keys(facets.facets)]);
	const filters: Record<string, string[]> = {};
	const problems: string[] = [];
	for (const [key, values] of Object.entries(raw)) {
		const baseField = key.startsWith('!') ? key.slice(1) : key;
		if (baseField === 'alertName' || isTagKeyColumn(baseField)) {
			filters[key] = values;
			continue;
		}
		if (!knownFields.has(baseField)) {
			const fields = [...knownFields].filter((field) => !isTagKeyColumn(field));
			const tagKeys = facets.tagKeys.map((tagKey) => `tagKey:${tagKey.key}`);
			problems.push(
				`Unknown filter field "${baseField}". Known fields: ${fields.join(', ')}` +
					(tagKeys.length > 0 ? `; tag fields: ${tagKeys.join(', ')}` : '') +
					'.'
			);
			continue;
		}
		const knownValues = [
			...new Set([...knownFilterValues(baseField, facets), ...(ALWAYS_KNOWN_VALUES[baseField] ?? [])]),
		];
		const canonical = new Map(knownValues.map((v) => [v.toLowerCase(), v]));
		const unknown = values.filter((v) => !canonical.has(v.toLowerCase()));
		if (unknown.length > 0) {
			problems.push(
				`Unknown value${unknown.length > 1 ? 's' : ''} ${describeValues(unknown)} for "${baseField}". ` +
					(knownValues.length > 0
						? `Known values: ${describeValues(knownValues)}.`
						: 'No alert currently has a value for this field.')
			);
			continue;
		}
		filters[key] = [...new Set(values.map((v) => canonical.get(v.toLowerCase()) as string))];
	}
	return problems.length > 0 ? { ok: false, problems } : { ok: true, filters };
};
