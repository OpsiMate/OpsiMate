import { Alert, AlertFix, AlertSeverity, AlertType, normalizeAlertFix, normalizeAlertSeverity } from '../types';

// How an alert PRESENTS — the values users see, filter on, and sort by. Lifted from the
// client so the server can filter/sort/facet with identical semantics: both sides import
// this one implementation, and the client's existing tests pin it. Anything visual
// (row tints, icons) stays in the client on top of these primitives.

// ---------- severity ----------

// Sort rank: higher = more severe, so a descending sort shows critical first.
export const SEVERITY_RANK: Record<AlertSeverity, number> = {
	[AlertSeverity.CRITICAL]: 3,
	[AlertSeverity.WARNING]: 2,
	[AlertSeverity.INFO]: 1,
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
	[AlertSeverity.CRITICAL]: 'Critical',
	[AlertSeverity.WARNING]: 'Warning',
	[AlertSeverity.INFO]: 'Info',
};

// The server always sets severity, but data from older deployments or playground fixtures
// may miss it — fall back to a `severity` tag, then a `priority` tag (P1–P5), then the
// default.
export const getAlertSeverity = (alert: Alert): AlertSeverity =>
	normalizeAlertSeverity(alert.severity ?? alert.tags?.['severity'] ?? alert.tags?.['priority']);

// ---------- fix ----------

export const FIX_LABELS: Record<AlertFix, string> = {
	[AlertFix.MANUAL]: 'Manual fix',
	[AlertFix.AUTO]: 'Auto fix',
};

// Sort rank: higher = needs a human, so a descending sort surfaces manual-fix alerts
// first; unclassified alerts (null) rank 0 and sink to the end either way.
export const FIX_RANK: Record<AlertFix, number> = {
	[AlertFix.MANUAL]: 2,
	[AlertFix.AUTO]: 1,
};

// The fix classification rides on a `fix` tag (there is no first-class column like
// severity's); null when the alert carries no recognizable value.
export const getAlertFix = (alert: Alert): AlertFix | null => normalizeAlertFix(alert.tags?.['fix']);

// ---------- owner ----------

// The slice of a user either side needs to render or sort an owner.
export interface AlertOwnerInfo {
	id: string;
	fullName: string;
}

export const getOwnerDisplayName = (ownerId: string | null | undefined, users: AlertOwnerInfo[]): string => {
	if (ownerId === null || ownerId === undefined) return 'Unassigned';
	const user = users.find((u) => u.id === ownerId);
	return user?.fullName || `User ${ownerId}`;
};

// Unassigned owners sort to the end.
export const getOwnerSortKey = (ownerId: string | null | undefined, users: AlertOwnerInfo[]): string => {
	if (ownerId === null || ownerId === undefined) return 'zzz_unassigned';
	const user = users.find((u) => u.id === ownerId);
	return user?.fullName?.toLowerCase() || `user_${ownerId}`;
};

// ---------- tags ----------

// Tags kept out of every tag UI (labels section, tag columns, facets, TV cards). The
// severity tag is an internal mirror of the first-class severity field, and the fix tag
// backs the first-class Fix column/badge the same way — users interact with the dedicated
// column/badges, never the raw tag.
export const HIDDEN_TAG_KEYS = new Set(['severity', 'fix']);

export const getAlertTagsArray = (alert: Alert): string[] => {
	if (!alert.tags || typeof alert.tags !== 'object') return [];
	return Object.entries(alert.tags)
		.filter(([key, value]) => !HIDDEN_TAG_KEYS.has(key) && Boolean(value))
		.map(([, value]) => value);
};

export const getAlertTagsString = (alert: Alert): string => {
	const tags = getAlertTagsArray(alert);
	return tags.join(', ') || '';
};

export const getAlertPrimaryTag = (alert: Alert): string | undefined => {
	const tags = getAlertTagsArray(alert);
	return tags[0];
};

export const hasAlertTags = (alert: Alert): boolean => {
	return getAlertTagsArray(alert).length > 0;
};

export const alertMatchesTagFilter = (alert: Alert, filterValues: string[]): boolean => {
	if (filterValues.length === 0) return true;
	const tags = getAlertTagsArray(alert);
	return tags.some((tag) => filterValues.includes(tag));
};

export const getAlertTagEntries = (alert: Alert): Array<{ key: string; value: string }> => {
	if (!alert.tags || typeof alert.tags !== 'object') return [];
	return Object.entries(alert.tags)
		.filter(([key, value]) => !HIDDEN_TAG_KEYS.has(key) && Boolean(value))
		.map(([key, value]) => ({ key, value }));
};

// ---------- tag-key columns ----------

export const TAG_KEY_COLUMN_PREFIX = 'tagKey:';

export const getTagKeyColumnId = (tagKey: string): string => `${TAG_KEY_COLUMN_PREFIX}${tagKey}`;

export const isTagKeyColumn = (columnId: string): boolean => columnId.startsWith(TAG_KEY_COLUMN_PREFIX);

export const extractTagKeyFromColumnId = (columnId: string): string | null => {
	if (!isTagKeyColumn(columnId)) return null;
	return columnId.slice(TAG_KEY_COLUMN_PREFIX.length);
};

export const getTagKeyValue = (alert: Alert, columnId: string): string => {
	const tagKey = extractTagKeyFromColumnId(columnId);
	if (!tagKey) return '';
	return alert.tags?.[tagKey] || '';
};

// ---------- integration ----------

export type AlertIntegrationKind = Lowercase<AlertType>;

export const INTEGRATION_LABELS: Record<AlertIntegrationKind, string> = {
	grafana: 'Grafana',
	gcp: 'Google Cloud',
	uptimekuma: 'Uptime Kuma',
	datadog: 'Datadog',
	zabbix: 'Zabbix',
	custom: 'Custom',
};

export const normalizeIntegration = (value?: string | null): AlertIntegrationKind | undefined => {
	if (!value) return undefined;
	const normalized = value.toLowerCase();
	if (normalized.includes('grafana')) return 'grafana';
	if (normalized.includes('gcp') || normalized.includes('google')) return 'gcp';
	if (normalized.includes('uptimekuma') || normalized.includes('uptime-kuma')) return 'uptimekuma';
	if (normalized.includes('datadog')) return 'datadog';
	if (normalized.includes('zabbix')) return 'zabbix';
	if (normalized.includes('custom')) return 'custom';
	return undefined;
};

export const resolveAlertIntegration = (alert: Alert): AlertIntegrationKind => {
	return (
		normalizeIntegration(alert.type) ||
		normalizeIntegration(getAlertPrimaryTag(alert)) ||
		normalizeIntegration(alert.id) ||
		normalizeIntegration(alert.summary) ||
		'custom'
	);
};

export const getIntegrationLabel = (integration: AlertIntegrationKind): string => INTEGRATION_LABELS[integration];
