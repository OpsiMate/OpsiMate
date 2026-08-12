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
		const fieldValue = getAlertFilterFieldValue(alert, isExclusion ? key.slice(1) : key, users);
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
	if (!searchTerm.trim()) return alerts;

	const lower = searchTerm.toLowerCase();
	return alerts.filter((alert) => {
		const integration = resolveAlertIntegration(alert);
		const integrationLabel = getIntegrationLabel(integration).toLowerCase();
		const tagsString = getAlertTagsString(alert).toLowerCase();
		return (
			(alert.alertName && alert.alertName.toLowerCase().includes(lower)) ||
			(alert.status && alert.status.toLowerCase().includes(lower)) ||
			tagsString.includes(lower) ||
			(alert.summary && alert.summary.toLowerCase().includes(lower)) ||
			(alert.lastComment && alert.lastComment.toLowerCase().includes(lower)) ||
			integrationLabel.includes(lower)
		);
	});
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
			return alert.isSilenced ? 'silenced' : alert.isMuted ? 'muted' : 'firing';
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
		case 'startsAt': {
			const date = new Date(alert.startsAt);
			return isNaN(date.getTime()) ? 0 : date.getTime();
		}
		case 'updatedAt': {
			const date = new Date(alert.updatedAt);
			return isNaN(date.getTime()) ? 0 : date.getTime();
		}
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

export const sortAlertsBy = (
	alerts: Alert[],
	sortField: string,
	sortDirection: AlertSortDirection,
	users: AlertOwnerInfo[] = []
): Alert[] => {
	return [...alerts].sort((a, b) => compareAlerts(a, b, sortField, sortDirection, users));
};

// ---------- paging ----------

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
	let result = alerts;
	result = applyTimeWindow(result, { from: query.from ?? null, to: query.to ?? null });
	if (query.filters && Object.keys(query.filters).length > 0) {
		const filters = query.filters;
		result = result.filter((alert) => alertMatchesFilters(alert, filters, users));
	}
	if (query.search) {
		result = searchAlerts(result, query.search);
	}

	const sortField = query.sort ?? DEFAULT_ALERT_SORT;
	const dir = query.dir ?? DEFAULT_ALERT_SORT_DIR;
	result = sortAlertsBy(result, sortField, dir, users);

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
	const tagKeys = collectAlertTagKeys(alerts);
	const facetFields = fields ?? [...BASE_ALERT_FACET_FIELDS, ...tagKeys.map((tk) => getTagKeyColumnId(tk.key))];
	const passesOtherFilters = (alert: Alert, exceptField: string): boolean => {
		for (const [key, values] of Object.entries(filters)) {
			if (values.length === 0) continue;
			const isExclusion = key.startsWith('!');
			const field = isExclusion ? key.slice(1) : key;
			if (field === exceptField) continue;
			const fieldValue = getAlertFilterFieldValue(alert, field, users);
			if (fieldValue === null) continue;
			if (isExclusion ? values.includes(fieldValue) : !values.includes(fieldValue)) {
				return false;
			}
		}
		return true;
	};

	const facets: Record<string, Record<string, number>> = {};
	for (const field of facetFields) {
		const counts: Record<string, number> = {};
		for (const alert of alerts) {
			if (!passesOtherFilters(alert, field)) continue;
			const value = getAlertFilterFieldValue(alert, field, users);
			if (value === null || value === '') continue;
			counts[value] = (counts[value] ?? 0) + 1;
		}
		facets[field] = counts;
	}

	return {
		facets,
		total: alerts.length,
		silencedTotal: alerts.filter((a) => a.isSilenced).length,
		tagKeys,
	};
};
