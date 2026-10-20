import { Alert, AlertFacetsResult, AlertListQuery, AlertOwnerInfo, getAlertFilterFieldValue } from '@OpsiMate/shared';
import { McpDeps } from './deps';
import { toAlertSummary } from './project';
import { McpAlertCounts, McpAlertPage } from './schemas';

// Reading the two alert lists (active, resolved) for the tools: one place that knows
// which BL method serves which list, so the dashboard and search tools page the same way.

export type AlertListName = 'active' | 'resolved';
export type AlertListInclude = AlertListName | 'all';

export const listsFor = (include: AlertListInclude): AlertListName[] =>
	include === 'all' ? ['active', 'resolved'] : [include];

export const queryList = (deps: McpDeps, list: AlertListName, query: AlertListQuery) =>
	list === 'resolved' ? deps.alertBL.queryResolvedAlerts(query) : deps.alertBL.queryAlerts(query);

// A cursor is only ever what a tool returned: encodeAlertCursor's JSON with a string
// id. The engine reads anything else as a bare alert id, finds no such row and starts
// the page where that id would sort — an empty page under a non-zero total, which an
// assistant would read as "no more results". Rejected up front instead, naming the fix.
export const cursorProblem = (cursor: string | undefined): string | null => {
	if (cursor === undefined) return null;
	try {
		const parsed: unknown = JSON.parse(cursor);
		if (typeof parsed === 'object' && parsed !== null && 'id' in parsed && typeof parsed.id === 'string') {
			return null;
		}
	} catch {
		// Not JSON at all.
	}
	return (
		"The cursor is not one this tool returned: pass the previous page's nextCursor unchanged, " +
		'or omit it for the first page.'
	);
};

export const toPage = (
	items: Alert[],
	total: number,
	nextCursor: string | null,
	owners: AlertOwnerInfo[]
): McpAlertPage => ({
	items: items.map((alert) => toAlertSummary(alert, owners)),
	total,
	nextCursor,
});

// Counts by display severity/status over whole result sets — what a "how bad is it"
// question needs without paging through everything.
export const countAlerts = (alerts: Alert[], owners: AlertOwnerInfo[]): McpAlertCounts => {
	const bySeverity: Record<string, number> = {};
	const byStatus: Record<string, number> = {};
	for (const alert of alerts) {
		const severity = getAlertFilterFieldValue(alert, 'severity', owners) ?? alert.severity;
		const status = getAlertFilterFieldValue(alert, 'status', owners) ?? alert.status;
		bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;
		byStatus[status] = (byStatus[status] ?? 0) + 1;
	}
	return { total: alerts.length, bySeverity, byStatus };
};

// The All view describes active + resolved together: counts add, tag keys union (the
// client merges its two facet responses the same way).
export const mergeFacets = (a: AlertFacetsResult, b: AlertFacetsResult): AlertFacetsResult => {
	const facets: Record<string, Record<string, number>> = {};
	for (const field of new Set([...Object.keys(a.facets), ...Object.keys(b.facets)])) {
		const merged: Record<string, number> = { ...a.facets[field] };
		for (const [value, count] of Object.entries(b.facets[field] ?? {})) {
			merged[value] = (merged[value] ?? 0) + count;
		}
		facets[field] = merged;
	}
	const tagKeys = new Map<string, Set<string>>();
	const labels = new Map<string, string>();
	for (const tagKey of [...a.tagKeys, ...b.tagKeys]) {
		const values = tagKeys.get(tagKey.key) ?? new Set<string>();
		tagKey.values.forEach((value) => values.add(value));
		tagKeys.set(tagKey.key, values);
		labels.set(tagKey.key, tagKey.label);
	}
	return {
		facets,
		total: a.total + b.total,
		silencedTotal: a.silencedTotal + b.silencedTotal,
		tagKeys: [...tagKeys.entries()]
			.map(([key, values]) => ({ key, label: labels.get(key) ?? key, values: [...values].sort() }))
			.sort((x, y) => x.label.localeCompare(y.label)),
	};
};

// The live vocabulary a filter record is validated against: the facets of the list(s)
// the call reads, unconstrained (every value that exists, not just those passing some
// other filter).
export const loadFacets = async (deps: McpDeps, include: AlertListInclude): Promise<AlertFacetsResult> => {
	if (include === 'active') return deps.alertBL.getAlertFacets({});
	if (include === 'resolved') return deps.alertBL.getResolvedAlertFacets({});
	const [active, resolved] = await Promise.all([
		deps.alertBL.getAlertFacets({}),
		deps.alertBL.getResolvedAlertFacets({}),
	]);
	return mergeFacets(active, resolved);
};
