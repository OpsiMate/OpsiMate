import { ActiveFilters } from '@/components/shared';

// The status value a silenced alert presents (see useAlertsFiltering's getFieldValue).
export const SILENCED_STATUS = 'Silenced';

const STATUS_FIELD = 'status';
const STATUS_EXCLUDE_FIELD = '!status';

// Whether silenced alerts are part of what the current filters show. Three cases, because
// the status filter has two halves: an include list and an exclusion list ("!status").
//   - excluded outright        → hidden
//   - an include list is set   → shown only if it lists Silenced
//   - no status filter at all  → everything shows, silenced included
export const areSilencedAlertsShown = (filters: ActiveFilters): boolean => {
	if ((filters[STATUS_EXCLUDE_FIELD] ?? []).includes(SILENCED_STATUS)) return false;
	const included = filters[STATUS_FIELD] ?? [];
	if (included.length > 0) return included.includes(SILENCED_STATUS);
	return true;
};

// Flips silenced alerts in or out of view, expressed in the same filters record the sidebar
// edits — so the toolbar button and the Status section can never disagree, and the change
// persists with the dashboard like any other filter.
//
// Hiding has to handle both shapes: with an include list, dropping Silenced from it is
// enough; with no include list, only an exclusion can express "everything but silenced".
// The empty-include case matters too — removing the last included value would lift the
// filter entirely and bring silenced alerts back, so that case switches to an exclusion.
export const toggleSilencedAlerts = (filters: ActiveFilters): ActiveFilters => {
	const included = filters[STATUS_FIELD] ?? [];
	const excluded = filters[STATUS_EXCLUDE_FIELD] ?? [];
	const next = { ...filters };

	const setField = (field: string, values: string[]) => {
		if (values.length === 0) {
			delete next[field];
		} else {
			next[field] = values;
		}
	};

	if (areSilencedAlertsShown(filters)) {
		const withoutSilenced = included.filter((v) => v !== SILENCED_STATUS);
		if (included.length > 0 && withoutSilenced.length > 0) {
			setField(STATUS_FIELD, withoutSilenced);
			setField(STATUS_EXCLUDE_FIELD, excluded);
		} else {
			// No include list to narrow (or narrowing it would empty it): exclude instead.
			setField(STATUS_FIELD, withoutSilenced);
			setField(STATUS_EXCLUDE_FIELD, [...excluded, SILENCED_STATUS]);
		}
		return next;
	}

	setField(
		STATUS_EXCLUDE_FIELD,
		excluded.filter((v) => v !== SILENCED_STATUS)
	);
	// An include list that omits Silenced would keep hiding them once the exclusion is gone.
	setField(STATUS_FIELD, included.length > 0 ? [...new Set([...included, SILENCED_STATUS])] : included);
	return next;
};
