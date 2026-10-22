import {
	Alert,
	AlertComment,
	AlertOwnerInfo,
	Dashboard,
	getAlertFilterFieldValue,
	getOwnerDisplayName,
	HIDDEN_TAG_KEYS,
} from '@OpsiMate/shared';
import { McpAlertComment, McpAlertSummary, McpDashboardSummary } from './schemas';

// Projections of the API shapes for an assistant: the fields that describe the thing,
// without the ones that only drive the UI (column layout, read markers, raw owner ids).

// The tags a user sees: the severity and fix tags are internal mirrors of first-class
// fields (the UI hides them everywhere, and they are no "tagKey:" filter field), so an
// assistant must not learn them as tags to filter by.
const visibleTags = (tags: Record<string, string> | undefined): Record<string, string> =>
	Object.fromEntries(Object.entries(tags ?? {}).filter(([key]) => !HIDDEN_TAG_KEYS.has(key)));

// Status and severity are the DISPLAY values (Firing/Silenced/Muted/Resolved, Critical/
// Warning/Info) — the same strings the filters accept, so what a tool shows can be
// pasted straight back into a filter. The owner id becomes the user's name for the
// same reason.
export const toAlertSummary = (alert: Alert, owners: AlertOwnerInfo[]): McpAlertSummary => ({
	id: alert.id,
	alertName: alert.alertName,
	status: getAlertFilterFieldValue(alert, 'status', owners) ?? alert.status,
	severity: getAlertFilterFieldValue(alert, 'severity', owners) ?? alert.severity,
	type: getAlertFilterFieldValue(alert, 'type', owners) ?? alert.type,
	owner: getOwnerDisplayName(alert.ownerId, owners),
	team: alert.team ?? null,
	tags: visibleTags(alert.tags),
	summary: alert.summary ?? null,
	startsAt: alert.startsAt,
	updatedAt: alert.updatedAt,
	isSilenced: alert.isSilenced,
	silencedUntil: alert.silencedUntil ?? null,
	isMuted: alert.isMuted ?? false,
	lastComment: alert.lastComment ?? null,
	alertUrl: alert.alertUrl,
	runbookUrl: alert.runbookUrl ?? null,
	links: alert.links ?? [],
});

// The stored filter record is `Record<string, unknown>` (the client writes it, the server
// only stores it). Only `field -> string[]` entries are filters; anything else is junk a
// stale client left behind and is dropped, as the query engine would ignore it anyway.
export const parseDashboardFilters = (
	filters: Record<string, unknown> | null | undefined
): Record<string, string[]> => {
	const parsed: Record<string, string[]> = {};
	for (const [field, values] of Object.entries(filters ?? {})) {
		if (Array.isArray(values) && values.every((value): value is string => typeof value === 'string')) {
			parsed[field] = values;
		}
	}
	return parsed;
};

export const toDashboardSummary = (dashboard: Dashboard): McpDashboardSummary => ({
	id: String(dashboard.id),
	name: dashboard.name,
	type: dashboard.type,
	description: dashboard.description ?? '',
	filters: parseDashboardFilters(dashboard.filters),
	query: dashboard.query ?? '',
	groupBy: dashboard.groupBy ?? [],
	timeRange: dashboard.timeRange
		? {
				preset: dashboard.timeRange.preset ?? null,
				from: dashboard.timeRange.from ?? null,
				to: dashboard.timeRange.to ?? null,
			}
		: null,
	createdAt: dashboard.createdAt ?? null,
});

export const toCommentSummary = (comment: AlertComment, owners: AlertOwnerInfo[]): McpAlertComment => ({
	id: String(comment.id),
	author: getOwnerDisplayName(comment.userId, owners),
	comment: comment.comment,
	createdAt: comment.createdAt,
	updatedAt: comment.updatedAt,
});
