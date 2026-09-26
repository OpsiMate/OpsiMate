import { Alert } from '../types';
import {
	AlertOwnerInfo,
	HIDDEN_TAG_KEYS,
	extractTagKeyFromColumnId,
	FIX_RANK,
	getAlertFix,
	getAlertSeverity,
	getAlertTagsString,
	getIntegrationLabel,
	getOwnerDisplayName,
	getOwnerSortKey,
	getTagKeyColumnId,
	getTagKeyValue,
	isTagKeyColumn,
	resolveAlertIntegration,
	SEVERITY_LABELS,
	SEVERITY_RANK,
} from './alertView';

// The alerts query engine — the ONE implementation of how the alert list is filtered,
// searched, sorted, faceted and paged. The client has always run this in the browser;
// the server runs the same functions so a query pushed server-side can never disagree
// with what the client would have shown. Semantics are pinned by the client's tests.

// Sidebar filters as the dashboard stores them: field -> accepted display values, with
// "!field" entries as exclusions. Field names are the base columns plus tagKey:<key>.
export type AlertListFilters = Record<string, string[]>;

const capitalizeFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

const getAlertType = (alert: Alert): string => alert.type || 'Custom';

// The value an alert presents for a filter field; null when the field is unknown
// (unknown fields never constrain — a stale persisted filter must not hide everything).
// ---------- per-object memos ----------
//
// The server keeps the same alert object between list rebuilds while that alert's inputs
// are unchanged, and the same array while nothing changed at all (the client's arrays
// from a fetch are immutable too). So anything derived from one alert can be remembered
// on the object — a WeakMap keyed by identity, released with it — and anything derived
// from the whole list on the array. Every query used to rebuild all of it: at 50k alerts
// a free-text search cost ~120ms and facets ~110ms, per user with a distinct search,
// per list change. With the memos a query is a filter over precomputed strings.
//
// Nothing here may be served for a MUTATED object or array: consumers treat both as
// immutable (a changed alert is a new object, a changed list a new array).

// The base filter/facet field values that depend only on the alert, computed together
// on first touch. Tag fields read straight from alert.tags (no cheaper memo exists) and
// the owner field depends on the users list, so neither is memoized.
interface BaseFieldValues {
	status: string;
	severity: string;
	type: string;
	alertName: string;
}
const baseFieldValues = new WeakMap<Alert, BaseFieldValues>();
const NO_USERS: AlertOwnerInfo[] = [];
const getBaseFieldValues = (alert: Alert): BaseFieldValues => {
	let values = baseFieldValues.get(alert);
	if (!values) {
		values = {
			status: getAlertFilterFieldValue(alert, 'status', NO_USERS) ?? '',
			severity: getAlertFilterFieldValue(alert, 'severity', NO_USERS) ?? '',
			type: getAlertFilterFieldValue(alert, 'type', NO_USERS) ?? '',
			alertName: getAlertFilterFieldValue(alert, 'alertName', NO_USERS) ?? '',
		};
		baseFieldValues.set(alert, values);
	}
	return values;
};
const isBaseField = (field: string): field is keyof BaseFieldValues =>
	field === 'status' || field === 'severity' || field === 'type' || field === 'alertName';
const memoFilterFieldValue = (alert: Alert, field: string, users: AlertOwnerInfo[]): string | null => {
	if (isBaseField(field)) return getBaseFieldValues(alert)[field];
	return getAlertFilterFieldValue(alert, field, users);
};

// Everything free-text search looks at, lowercased, joined by a character no search
// term contains — so one includes() per alert replaces six, and the same alert is
// only ever prepared once.
const SEARCH_FIELD_SEPARATOR = '\u0000';
const searchTexts = new WeakMap<Alert, string>();
const getSearchText = (alert: Alert): string => {
	let text = searchTexts.get(alert);
	if (text === undefined) {
		text = [
			alert.alertName,
			alert.status,
			getAlertTagsString(alert),
			alert.summary,
			alert.lastComment,
			getIntegrationLabel(resolveAlertIntegration(alert)),
		]
			.map((value) => (value ?? '').toLowerCase())
			.join(SEARCH_FIELD_SEPARATOR);
		searchTexts.set(alert, text);
	}
	return text;
};

// Parsed timestamps for the date sort keys.
interface AlertTimes {
	startsAt: number;
	updatedAt: number;
}
const alertTimes = new WeakMap<Alert, AlertTimes>();
const getAlertTimes = (alert: Alert): AlertTimes => {
	let times = alertTimes.get(alert);
	if (!times) {
		const starts = new Date(alert.startsAt).getTime();
		const updated = new Date(alert.updatedAt).getTime();
		times = { startsAt: isNaN(starts) ? 0 : starts, updatedAt: isNaN(updated) ? 0 : updated };
		alertTimes.set(alert, times);
	}
	return times;
};

// Parsed firingTimes, for the time-window episode rewrite (see applyTimeWindow).
interface FiringEpoch {
	iso: string;
	epoch: number;
}
const firingEpochs = new WeakMap<Alert, FiringEpoch[]>();
const getFiringEpochs = (alert: Alert): FiringEpoch[] => {
	let epochs = firingEpochs.get(alert);
	if (!epochs) {
		epochs = [alert.startsAt, ...(alert.firingTimes ?? [])]
			.map((iso) => ({ iso, epoch: new Date(iso).getTime() }))
			.filter(({ epoch }) => !isNaN(epoch));
		firingEpochs.set(alert, epochs);
	}
	return epochs;
};
// The alert as the window shows it: startsAt moved to the latest firing at or before the
// window's end (the episode inside the window). Same object when nothing moves.
const episodeInWindow = (alert: Alert, windowEnd: number): Alert => {
	let latest: FiringEpoch | null = null;
	for (const candidate of getFiringEpochs(alert)) {
		if (candidate.epoch <= windowEnd && (!latest || candidate.epoch > latest.epoch)) latest = candidate;
	}
	return !latest || latest.iso === alert.startsAt ? alert : { ...alert, startsAt: latest.iso };
};

// The list sorted by a field, per array. A filter over a sorted array keeps its order,
// so the sort — the one O(n log n) step — runs once per list per sort field and every
// query (any filters, any search) reuses it. Owner order depends on the users list, so
// that list's identity is part of the key.
const sortedOrders = new WeakMap<Alert[], Map<string, Alert[]>>();
const usersListIds = new WeakMap<AlertOwnerInfo[], number>();
let nextUsersListId = 0;
const usersListId = (users: AlertOwnerInfo[]): number => {
	let id = usersListIds.get(users);
	if (id === undefined) {
		id = ++nextUsersListId;
		usersListIds.set(users, id);
	}
	return id;
};
const sortedOrder = (alerts: Alert[], sortField: string, dir: AlertSortDirection, users: AlertOwnerInfo[]): Alert[] => {
	let perArray = sortedOrders.get(alerts);
	if (!perArray) {
		perArray = new Map();
		sortedOrders.set(alerts, perArray);
	}
	// Only the owner order depends on the users list; keying every sort by it would
	// keep one more full sorted array per owners refresh.
	const key = sortField === 'owner' ? `${sortField}|${dir}|${usersListId(users)}` : `${sortField}|${dir}`;
	let sorted = perArray.get(key);
	if (!sorted) {
		sorted = sortAlertsBy(alerts, sortField, dir, users);
		perArray.set(key, sorted);
	}
	return sorted;
};

// The tag keys present in a list, per array.
const tagKeyInfos = new WeakMap<Alert[], AlertTagKeyInfo[]>();

// Per-array columns: the search text and each filter field's value for every alert,
// in array order. Built once per array from the per-object memos (so a new snapshot
// of mostly unchanged alerts builds them from lookups, not from scratch) and then a
// query is a loop over plain arrays — no per-alert lookups, no per-alert allocations.
interface ListColumns {
	searchTexts: string[] | null;
	fields: Map<string, (string | null)[]>;
}
const listColumns = new WeakMap<Alert[], ListColumns>();
const columnsOf = (alerts: Alert[]): ListColumns => {
	let columns = listColumns.get(alerts);
	if (!columns) {
		columns = { searchTexts: null, fields: new Map() };
		listColumns.set(alerts, columns);
	}
	return columns;
};
const searchTextColumn = (alerts: Alert[]): string[] => {
	const columns = columnsOf(alerts);
	columns.searchTexts ??= alerts.map(getSearchText);
	return columns.searchTexts;
};
// The owner column depends on the users list, so it is keyed by that list's identity.
const columnKey = (field: string, users: AlertOwnerInfo[]): string =>
	field === 'owner' ? `owner|${usersListId(users)}` : field;
// Builds every missing column for `fields` in ONE pass over the list: one memo lookup
// per alert, then a write per column. Column-by-column it was a lookup per alert per
// column — 1.25M lookups and ~750ms for 25 facet fields at 50k alerts, on every new
// list; now ~50k lookups.
const fieldColumns = (alerts: Alert[], fields: string[], users: AlertOwnerInfo[]): (string | null)[][] => {
	const columns = columnsOf(alerts);
	const result: (string | null)[][] = [];
	const missing: { index: number; field: string; column: (string | null)[] }[] = [];
	fields.forEach((field, index) => {
		const key = columnKey(field, users);
		let column = columns.fields.get(key);
		if (!column) {
			column = new Array<string | null>(alerts.length);
			columns.fields.set(key, column);
			missing.push({ index, field, column });
		}
		result[index] = column;
	});
	if (missing.length === 0) return result;
	const tagKeyOf = new Map<string, string | null>();
	for (const { field } of missing) {
		if (isTagKeyColumn(field)) tagKeyOf.set(field, extractTagKeyFromColumnId(field) ?? null);
	}
	for (let i = 0; i < alerts.length; i++) {
		const alert = alerts[i];
		let base: BaseFieldValues | null = null;
		for (const { field, column } of missing) {
			if (isBaseField(field)) {
				base ??= getBaseFieldValues(alert);
				column[i] = base[field];
			} else if (tagKeyOf.has(field)) {
				const tagKey = tagKeyOf.get(field);
				column[i] = tagKey ? alert.tags?.[tagKey] || '' : null;
			} else {
				column[i] = getAlertFilterFieldValue(alert, field, users);
			}
		}
	}
	return result;
};

// One parsed filter: field column + accepted values + include/exclude.
interface ResolvedFilter {
	column: (string | null)[];
	values: string[];
	exclude: boolean;
}
const resolveFilters = (alerts: Alert[], filters: AlertListFilters, users: AlertOwnerInfo[]): ResolvedFilter[] => {
	const active = Object.entries(filters).filter(([, values]) => values.length > 0);
	const columns = fieldColumns(
		alerts,
		active.map(([key]) => (key.startsWith('!') ? key.slice(1) : key)),
		users
	);
	return active.map(([key, values], i) => ({ column: columns[i], values, exclude: key.startsWith('!') }));
};
// Same semantics as alertMatchesFilters: a null field value never disqualifies.
const passesResolved = (resolved: ResolvedFilter[], index: number, skipColumn?: (string | null)[]): boolean => {
	for (const { column, values, exclude } of resolved) {
		if (column === skipColumn) continue;
		const value = column[index];
		if (value === null) continue;
		if (exclude ? values.includes(value) : !values.includes(value)) return false;
	}
	return true;
};

export const getAlertFilterFieldValue = (alert: Alert, field: string, users: AlertOwnerInfo[]): string | null => {
	if (isTagKeyColumn(field)) {
		const tagKey = extractTagKeyFromColumnId(field);
		return tagKey ? alert.tags?.[tagKey] || '' : null;
	}
	switch (field) {
		case 'status':
			return alert.isSilenced ? 'Silenced' : alert.isMuted ? 'Muted' : capitalizeFirst(alert.status);
		case 'severity':
			return SEVERITY_LABELS[getAlertSeverity(alert)];
		case 'type':
			return getAlertType(alert);
		case 'alertName':
			return alert.alertName ?? '';
		case 'owner':
			return getOwnerDisplayName(alert.ownerId, users);
		default:
			return null;
	}
};

// One alert against the whole filters record — includes constrain, "!field" excludes.
export const alertMatchesFilters = (alert: Alert, filters: AlertListFilters, users: AlertOwnerInfo[]): boolean => {
	for (const [key, values] of Object.entries(filters)) {
		if (values.length === 0) continue;
		const isExclusion = key.startsWith('!');
		const fieldValue = memoFilterFieldValue(alert, isExclusion ? key.slice(1) : key, users);
		if (fieldValue === null) continue;
		if (isExclusion ? values.includes(fieldValue) : !values.includes(fieldValue)) {
			return false;
		}
	}
	return true;
};

// ---------- time window ----------

export interface ResolvedTimeWindow {
	from: string | null;
	to: string | null;
}

// Applies a concrete [from, to] window: an alert is in when its [startsAt, updatedAt]
// span overlaps the window. Inside a window, "Started At" is rewritten to the firing
// episode current as of the window's end — the LATEST transition into firing at or
// before the window closes. An alert that fired at 18:00, resolved at 19:00 and re-fired
// at 20:00 shows 20:00; transitions after the window's end belong to a later episode.
export const applyTimeWindow = (alerts: Alert[], window: ResolvedTimeWindow): Alert[] => {
	const from = window.from ? new Date(window.from) : null;
	const to = window.to ? new Date(window.to) : null;
	if (!from && !to) return alerts;

	const filterStart = from || new Date(0);
	const filterEnd = to || new Date();

	const result = alerts.filter((alert) => {
		const alertStartDate = new Date(alert.startsAt);
		const alertEndDate = new Date(alert.updatedAt);
		return alertStartDate <= filterEnd && alertEndDate >= filterStart;
	});

	return result.map((alert) => {
		// Numeric (epoch) comparison: startsAt can carry a timezone offset while
		// firingTimes are normalized UTC — lexicographic order would mis-pick across
		// formats.
		const candidates = [alert.startsAt, ...(alert.firingTimes ?? [])]
			.map((iso) => ({ iso, epoch: new Date(iso).getTime() }))
			.filter(({ epoch }) => !isNaN(epoch) && epoch <= filterEnd.getTime());
		if (candidates.length === 0) return alert;
		const episodeStart = candidates.reduce((latest, c) => (c.epoch > latest.epoch ? c : latest));
		return episodeStart.iso === alert.startsAt ? alert : { ...alert, startsAt: episodeStart.iso };
	});
};

// ---------- search ----------

export const searchAlerts = (alerts: Alert[], searchTerm: string): Alert[] => {
	const trimmed = searchTerm.trim();
	if (!trimmed) return alerts;

	const lower = trimmed.toLowerCase();
	return alerts.filter((alert) => getSearchText(alert).includes(lower));
};

// ---------- sort ----------

export type AlertSortDirection = 'asc' | 'desc';

// Comparable value for one alert under a sort field; null means "field not sortable".
export const getAlertSortValue = (alert: Alert, sortField: string, users: AlertOwnerInfo[]): string | number | null => {
	if (isTagKeyColumn(sortField)) {
		return getTagKeyValue(alert, sortField).toLowerCase();
	}
	switch (sortField) {
		case 'alertName':
			return (alert.alertName ?? '').toLowerCase();
		case 'status':
			// The same canonical value the filter/facet path presents (Silenced/Muted
			// win over the raw status), lowercased for ordering. The raw status must
			// flow through: views that mix active and resolved alerts (the All view)
			// sort Resolved rows as their own group — a hardcoded 'firing' fallback
			// used to interleave them with live alerts, which read as sort-not-working.
			return (getAlertFilterFieldValue(alert, 'status', users) ?? '').toLowerCase();
		case 'severity':
			// Rank-based so desc = critical first, info last.
			return SEVERITY_RANK[getAlertSeverity(alert)];
		case 'fix': {
			// Rank-based so desc = manual first; unclassified alerts sink to rank 0.
			const fix = getAlertFix(alert);
			return fix ? FIX_RANK[fix] : 0;
		}
		case 'summary':
			return (alert.summary || '').toLowerCase();
		case 'lastComment':
			return (alert.lastComment || '').toLowerCase();
		case 'startsAt':
			return getAlertTimes(alert).startsAt;
		case 'updatedAt':
			return getAlertTimes(alert).updatedAt;
		case 'type':
			return getIntegrationLabel(resolveAlertIntegration(alert)).toLowerCase();
		case 'owner':
			return getOwnerSortKey(alert.ownerId, users);
		default:
			return null;
	}
};

// Equal sort values fall back to the alert id, so the order is total — which both keeps
// the visual order stable across refetches and is what makes keyset cursors well-defined.
export const compareAlerts = (
	a: Alert,
	b: Alert,
	sortField: string,
	sortDirection: AlertSortDirection,
	users: AlertOwnerInfo[]
): number => {
	const aValue = getAlertSortValue(a, sortField, users);
	const bValue = getAlertSortValue(b, sortField, users);
	if (aValue !== null && bValue !== null) {
		if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
		if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
	}
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

// One decorated row of the sort below: the alert with its sort key extracted once.
interface SortDecoratedAlert {
	alert: Alert;
	key: string | number | null;
}

// Decorate-sort-undecorate. getAlertSortValue lowercases strings, parses dates and
// scans the users list — calling it per COMPARISON (as a plain sort(comparator) does)
// makes the sort O(n log n) key extractions and was the single largest CPU consumer in
// a production-shaped profile. Extracting each key once keeps the comparator to
// primitive compares. Ordering semantics are compareAlerts' exactly: values compare
// only when both are non-null, and ties (or null keys) fall back to the alert id so
// the order stays total and keyset cursors stay well-defined.
export const sortAlertsBy = (
	alerts: Alert[],
	sortField: string,
	sortDirection: AlertSortDirection,
	users: AlertOwnerInfo[] = []
): Alert[] => {
	const flip = sortDirection === 'asc' ? 1 : -1;
	const decorated: SortDecoratedAlert[] = alerts.map((alert) => ({
		alert,
		key: getAlertSortValue(alert, sortField, users),
	}));
	decorated.sort((a, b) => {
		if (a.key !== null && b.key !== null) {
			if (a.key < b.key) return -flip;
			if (a.key > b.key) return flip;
		}
		return a.alert.id < b.alert.id ? -1 : a.alert.id > b.alert.id ? 1 : 0;
	});
	return decorated.map((d) => d.alert);
};

// ---------- paging ----------

// ---------- bulk actions (one request mutates every alert in scope) ----------

export type AlertBulkActionType = 'silence' | 'unsilence' | 'resolve' | 'assignOwner' | 'comment';

// The bulk-action request contract, shared by the server's endpoint, the client's api
// layer and the playground mock so the shape is declared exactly once. Exactly one of
// ids/query must be present (the server's schema enforces it): ids is the loaded
// selection, query is resolved server-side against the full dataset.
export interface AlertBulkActionRequest {
	action: AlertBulkActionType;
	ids?: string[];
	query?: Pick<AlertListQuery, 'filters' | 'from' | 'to' | 'search'>;
	// silence: ISO auto-expiry; null or absent silences until manually unsilenced.
	silencedUntil?: string | null;
	// silence/resolve: optional note stored as a comment; comment action: the body itself.
	comment?: string;
	// assignOwner: numeric user id to assign, null to unassign.
	ownerId?: string | null;
}

// succeeded means the action actually took effect; unknown ids count as failed.
export interface AlertBulkActionResult {
	matched: number;
	succeeded: number;
	failed: number;
}

export interface AlertListQuery {
	filters?: AlertListFilters;
	// Concrete window — rolling presets are resolved by the CALLER at request time, so
	// "Last 1 hour" re-anchors to the requesting clock, not a stored snapshot of it.
	from?: string | null;
	to?: string | null;
	search?: string;
	sort?: string;
	dir?: AlertSortDirection;
	limit?: number;
	// Opaque keyset cursor produced by a previous page (see encodeAlertCursor). Position
	// is recovered against the CURRENT sorted result, so rows appearing/disappearing
	// between polls shift the boundary by data, never duplicate-or-skip by arithmetic.
	cursor?: string;
}

// The cursor carries the boundary row's sort value alongside its id: if the row itself
// is gone by the next request, the position is recovered with the same comparator the
// sort used — a raw id comparison would only be right when id order happens to agree
// with the sort order.
interface AlertCursor {
	v: string | number | null;
	id: string;
}

export const encodeAlertCursor = (alert: Alert, sortField: string, users: AlertOwnerInfo[]): string =>
	JSON.stringify({ v: getAlertSortValue(alert, sortField, users), id: alert.id });

const decodeAlertCursor = (cursor: string): AlertCursor => {
	try {
		const parsed = JSON.parse(cursor) as Partial<AlertCursor>;
		if (typeof parsed === 'object' && parsed !== null && typeof parsed.id === 'string') {
			return { v: parsed.v ?? null, id: parsed.id };
		}
	} catch {
		// Not JSON: treat the whole string as a bare id (no sort value to anchor on).
	}
	return { v: null, id: cursor };
};

// Where the cursor row would sort relative to `alert`: negative when the cursor comes
// first. Mirrors compareAlerts, with the cursor's captured value standing in for the row.
const compareToCursor = (
	alert: Alert,
	cursor: AlertCursor,
	sortField: string,
	dir: AlertSortDirection,
	users: AlertOwnerInfo[]
): number => {
	const value = getAlertSortValue(alert, sortField, users);
	if (value !== null && cursor.v !== null) {
		if (cursor.v < value) return dir === 'asc' ? -1 : 1;
		if (cursor.v > value) return dir === 'asc' ? 1 : -1;
	}
	return cursor.id < alert.id ? -1 : cursor.id > alert.id ? 1 : 0;
};

export interface AlertListPage {
	items: Alert[];
	total: number;
	nextCursor: string | null;
}

export const DEFAULT_ALERT_SORT = 'startsAt';
export const DEFAULT_ALERT_SORT_DIR: AlertSortDirection = 'desc';

export const applyAlertListQuery = (alerts: Alert[], users: AlertOwnerInfo[], query: AlertListQuery): AlertListPage => {
	const sortField = query.sort ?? DEFAULT_ALERT_SORT;
	const dir = query.dir ?? DEFAULT_ALERT_SORT_DIR;
	// Sorted first, from the per-array memo; the window, filters and search below keep
	// that order and run over the sorted array's columns in one pass.
	const sorted = sortedOrder(alerts, sortField, dir, users);
	const from = query.from ? new Date(query.from).getTime() : null;
	const to = query.to ? new Date(query.to).getTime() : null;
	const hasWindow = from !== null || to !== null;
	const windowStart = from ?? 0;
	const windowEnd = to ?? Date.now();
	const resolved = query.filters ? resolveFilters(sorted, query.filters, users) : [];
	const search = query.search?.trim().toLowerCase() ?? '';
	const searchTexts = search ? searchTextColumn(sorted) : null;
	let result = sorted;
	if (hasWindow || resolved.length > 0 || searchTexts) {
		result = sorted.filter((alert, i) => {
			if (hasWindow) {
				const times = getAlertTimes(alert);
				if (!(times.startsAt <= windowEnd && times.updatedAt >= windowStart)) return false;
			}
			if (resolved.length > 0 && !passesResolved(resolved, i)) return false;
			return !searchTexts || searchTexts[i].includes(search);
		});
	}
	if (hasWindow) {
		// A window also rewrites startsAt to the episode that fired inside it (see
		// applyTimeWindow). Only re-fired alerts move; when any did and the order depends
		// on startsAt, the (near-sorted) result is sorted again.
		let moved = false;
		result = result.map((alert) => {
			const shown = episodeInWindow(alert, windowEnd);
			if (shown !== alert) moved = true;
			return shown;
		});
		if (moved && sortField === 'startsAt') result = sortAlertsBy(result, sortField, dir, users);
	}

	const total = result.length;
	if (query.limit === undefined) {
		return { items: result, total, nextCursor: null };
	}

	const limit = Math.max(1, query.limit);
	let start = 0;
	if (query.cursor) {
		const cursor = decodeAlertCursor(query.cursor);
		const cursorIndex = result.findIndex((alert) => alert.id === cursor.id);
		if (cursorIndex >= 0) {
			start = cursorIndex + 1;
		} else {
			// The cursor row left the result set (resolved, filtered away) between pages.
			// Recover the position order-wise with the sort comparator: the first row the
			// cursor would sort before is where the next page starts.
			start = result.findIndex((alert) => compareToCursor(alert, cursor, sortField, dir, users) < 0);
			if (start < 0) start = result.length;
		}
	}

	const items = result.slice(start, start + limit);
	const lastItem = items[items.length - 1];
	const nextCursor = start + limit < result.length && lastItem ? encodeAlertCursor(lastItem, sortField, users) : null;
	return { items, total, nextCursor };
};

// ---------- tag keys ----------

export interface AlertTagKeyInfo {
	key: string;
	label: string;
	values: string[];
}

const formatTagKeyLabel = (key: string): string => {
	if (!key) return '';
	return key
		.split(/[-_]/)
		.filter((word) => word.length > 0)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
};

// Distinct tag keys (hidden keys excluded) with their value sets — the source for tag
// columns, group-by options and sidebar facet fields.
export const collectAlertTagKeys = (alerts: Alert[]): AlertTagKeyInfo[] => {
	const tagKeyMap = new Map<string, Set<string>>();
	alerts.forEach((alert) => {
		if (alert.tags && typeof alert.tags === 'object') {
			Object.entries(alert.tags).forEach(([key, value]) => {
				if (HIDDEN_TAG_KEYS.has(key)) return;
				if (value) {
					if (!tagKeyMap.has(key)) tagKeyMap.set(key, new Set());
					tagKeyMap.get(key)?.add(value);
				}
			});
		}
	});
	return Array.from(tagKeyMap.entries())
		.map(([key, valuesSet]) => ({
			key,
			label: formatTagKeyLabel(key),
			values: Array.from(valuesSet).sort(),
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
};

// ---------- facets ----------

export const BASE_ALERT_FACET_FIELDS = ['status', 'severity', 'type', 'alertName', 'owner'] as const;

export interface AlertFacetsResult {
	// field -> display value -> count, computed with faceted semantics.
	facets: Record<string, Record<string, number>>;
	total: number;
	silencedTotal: number;
	// Distinct tag keys over the same raw dataset, so the sidebar (and tag columns) can
	// be built without ever downloading the full list.
	tagKeys: AlertTagKeyInfo[];
}

// Faceted filtering, exactly as the sidebar computes it: an alert counts toward a
// field's facet only if it passes every OTHER active filter (includes and "!field"
// exclusions). A facet never constrains itself — neither its includes nor its
// exclusions — so its own options stay fully visible. Computed over the RAW dataset:
// the sidebar describes what filters WOULD show, so time window and search don't
// constrain it.
export const computeAlertFacets = (
	alerts: Alert[],
	filters: AlertListFilters,
	fields: string[] | undefined,
	users: AlertOwnerInfo[]
): AlertFacetsResult => {
	let tagKeys = tagKeyInfos.get(alerts);
	if (!tagKeys) {
		tagKeys = collectAlertTagKeys(alerts);
		tagKeyInfos.set(alerts, tagKeys);
	}
	const facetFields = fields ?? [...BASE_ALERT_FACET_FIELDS, ...tagKeys.map((tk) => getTagKeyColumnId(tk.key))];
	const resolved = resolveFilters(alerts, filters, users);

	const columns = fieldColumns(alerts, facetFields, users);
	const facets: Record<string, Record<string, number>> = {};
	facetFields.forEach((field, f) => {
		const column = columns[f];
		const counts: Record<string, number> = {};
		for (let i = 0; i < column.length; i++) {
			const value = column[i];
			if (value === null || value === '') continue;
			// The sidebar describes what each filter WOULD show, so a field's own
			// filter is skipped when counting that field.
			if (resolved.length > 0 && !passesResolved(resolved, i, column)) continue;
			counts[value] = (counts[value] ?? 0) + 1;
		}
		facets[field] = counts;
	});

	let silencedTotal = 0;
	for (const alert of alerts) if (alert.isSilenced) silencedTotal++;
	return { facets, total: alerts.length, silencedTotal, tagKeys };
};
