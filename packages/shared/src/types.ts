export enum ProviderType {
	VM = 'VM',
	K8S = 'K8S',
}

// Client-side provider types for UI configuration
export type ClientProviderType =
	'server' | 'kubernetes' | 'aws-ec2' | 'aws-eks' | 'gcp-compute' | 'gcp-gke' | 'azure-vm' | 'azure-aks';

export enum IntegrationType {
	Grafana = 'Grafana',
	Kibana = 'Kibana',
	Datadog = 'Datadog',
}

export enum ServiceType {
	DOCKER = 'DOCKER',
	SYSTEMD = 'SYSTEMD',
	MANUAL = 'MANUAL',
}

export enum Role {
	Admin = 'admin',
	Editor = 'editor',
	Viewer = 'viewer',
	Operation = 'operation',
}

export enum SecretType {
	SSH = 'ssh',
	KUBECONFIG = 'kubeconfig',
}

export interface User {
	id: string;
	email: string;
	fullName: string;
	role: Role;
	createdAt: string;
	// Optional contact number, shown on the on-call page so responders can be phoned.
	phoneNumber?: string | null;
}

// On-call scheduling: a team is an ordered group of users where the order defines call
// priority (1 = called first). With a rotation interval set, the order shifts by one
// place every interval — computed from the anchor date, so no background job is needed.
export interface OncallTeamMember {
	userId: string;
	fullName: string;
	email: string;
	phoneNumber?: string | null;
	// 1-based call priority after applying the rotation shift (1 = on call now).
	priority: number;
}

export interface OncallTeam {
	id: number;
	name: string;
	// Days between rotation shifts; null (or 0) keeps the order fixed.
	rotationIntervalDays: number | null;
	// When the current base order took effect; rotation shifts are computed from here.
	rotationAnchor: string;
	members: OncallTeamMember[];
	// When the next shift happens (null when rotation is off or the team is empty).
	nextRotationAt: string | null;
}

export interface IntegrationUrls {
	name: string;
	url: string;
}

export interface Provider {
	id: number;
	name: string;
	providerIP?: string;
	username?: string;
	secretId?: number;
	privateKeyFilename?: string; // Deprecated: use secretId instead
	password?: string;
	SSHPort?: number;
	createdAt: string;
	providerType: ProviderType;
}

export interface ContainerDetails {
	id?: string;
	image?: string;
	created?: string;
	namespace?: string;
}

export interface Tag {
	id: number;
	name: string;
	color: string;
	createdAt: string;
}

export interface ServiceTag {
	id: number;
	serviceId: number;
	tagId: number;
	createdAt: string;
}

export interface Service {
	id: number;
	providerId: number;
	name: string;
	serviceIP?: string;
	serviceStatus: string;
	createdAt: string;
	serviceType: ServiceType;
	// todo - this be in different interface
	containerDetails?: ContainerDetails;
	tags?: Tag[];
	customFields?: Record<number, string>; // customFieldId -> value
}

export interface ServiceWithProvider extends Service {
	provider: Provider;
}

export interface DiscoveredService {
	name: string;
	serviceStatus: string;
	serviceIP: string;
	namespace?: string;
}

export interface DiscoveredPod {
	name: string;
}

export type AlertType = 'Grafana' | 'GCP' | 'Custom' | 'UptimeKuma' | 'Datadog' | 'Zabbix';

export enum AlertStatus {
	FIRING = 'firing',
	RESOLVED = 'resolved',
}

// Fixed severity scale. Integrations send free-form values (Zabbix "Disaster", Datadog
// "error", …) which are normalized onto this scale at ingestion time.
export enum AlertSeverity {
	CRITICAL = 'critical',
	WARNING = 'warning',
	INFO = 'info',
}

export const DEFAULT_ALERT_SEVERITY = AlertSeverity.WARNING;

// Synonyms seen across integrations, mapped case-insensitively onto the fixed scale.
const SEVERITY_SYNONYMS: Record<string, AlertSeverity> = {
	critical: AlertSeverity.CRITICAL,
	crit: AlertSeverity.CRITICAL,
	disaster: AlertSeverity.CRITICAL,
	emergency: AlertSeverity.CRITICAL,
	fatal: AlertSeverity.CRITICAL,
	error: AlertSeverity.CRITICAL,
	high: AlertSeverity.CRITICAL,
	p1: AlertSeverity.CRITICAL,
	warning: AlertSeverity.WARNING,
	warn: AlertSeverity.WARNING,
	average: AlertSeverity.WARNING,
	moderate: AlertSeverity.WARNING,
	medium: AlertSeverity.WARNING,
	p2: AlertSeverity.WARNING,
	p3: AlertSeverity.WARNING,
	info: AlertSeverity.INFO,
	information: AlertSeverity.INFO,
	informational: AlertSeverity.INFO,
	notice: AlertSeverity.INFO,
	low: AlertSeverity.INFO,
	ok: AlertSeverity.INFO,
	p4: AlertSeverity.INFO,
	p5: AlertSeverity.INFO,
};

// Maps any free-form severity string onto the fixed scale; unknown or missing values
// fall back to the default (warning) so every alert always has a severity. The hasOwn
// guard keeps prototype keys in user-controlled input ('constructor', '__proto__', …)
// from resolving to inherited object members instead of the default.
export function normalizeAlertSeverity(value?: string | null): AlertSeverity {
	if (!value) return DEFAULT_ALERT_SEVERITY;
	const key = value.trim().toLowerCase();
	return Object.hasOwn(SEVERITY_SYNONYMS, key) ? SEVERITY_SYNONYMS[key] : DEFAULT_ALERT_SEVERITY;
}

// How an alert gets fixed: by hand or by automation. Carried on a `fix` tag; unlike
// severity there is no default — most alerts have no fix classification and show nothing.
export enum AlertFix {
	MANUAL = 'manual',
	AUTO = 'auto',
}

const FIX_SYNONYMS: Record<string, AlertFix> = {
	manual: AlertFix.MANUAL,
	'manual fix': AlertFix.MANUAL,
	manualfix: AlertFix.MANUAL,
	manual_fix: AlertFix.MANUAL,
	'manual-fix': AlertFix.MANUAL,
	auto: AlertFix.AUTO,
	'auto fix': AlertFix.AUTO,
	autofix: AlertFix.AUTO,
	auto_fix: AlertFix.AUTO,
	'auto-fix': AlertFix.AUTO,
	automatic: AlertFix.AUTO,
	automated: AlertFix.AUTO,
};

// Maps a free-form fix string onto the manual/auto pair; unknown or missing values are
// null — "no classification", rendered as empty. Same hasOwn guard as severity.
export function normalizeAlertFix(value?: string | null): AlertFix | null {
	if (!value) return null;
	const key = value.trim().toLowerCase();
	return Object.hasOwn(FIX_SYNONYMS, key) ? FIX_SYNONYMS[key] : null;
}

// A link attached to an alert. `icon` is a free-form slug matched against the
// integration icon set (grafana, uptimekuma, gcp, datadog, zabbix, custom); empty or
// unrecognized values render the generic link icon.
export interface AlertLink {
	label: string;
	icon?: string;
	url: string;
}

export interface Alert {
	id: string;
	type: AlertType;
	status: AlertStatus;
	// Always present on API responses; alerts sent without one default to warning.
	severity: AlertSeverity;
	// Owning team, resolved at ingestion from an explicit field or a `team` tag; null when
	// the alert has no team. Links the alert to the on-call schedule in the details panel.
	team?: string | null;
	tags: Record<string, string>;
	startsAt: string;
	updatedAt: string;
	// Legacy single links, superseded by `links`: when `links` is absent they fold into
	// the links UI as "Source" / "Runbook" entries. Integrations still populate them.
	alertUrl: string;
	alertName: string;
	summary?: string;
	runbookUrl?: string;
	// The alert's link collection — each entry renders as a button in the details panel's
	// links section (and the row's ⋮ menu) with its icon when the slug is recognized.
	links?: AlertLink[];
	createdAt: string;
	isSilenced: boolean;
	// When the silence auto-expires (ISO); null while silenced means silenced forever.
	// Re-silencing always overwrites this, so the timer restarts on every silence.
	silencedUntil?: string | null;
	// False until someone opens the alert; unread alerts render bold in the table.
	isRead?: boolean;
	// Transient: set at fetch time when an active mute policy rule matches this alert. Not persisted.
	isMuted?: boolean;
	// Transient: text of the alert's newest comment, attached at fetch time for the optional
	// "Last Comment" table column. Not persisted on the alert row itself.
	lastComment?: string | null;
	// Transient: ISO timestamps of this alert's firing/unresolve transitions, attached at
	// fetch time. Lets the client show the first firing INSIDE an active time-filter range
	// instead of the original startsAt. Not persisted on the alert row itself.
	firingTimes?: string[];
	// Transient: set at fetch time with the enrichment rules that matched/decorated this alert.
	// Empty/undefined means the alert was not enriched. Not persisted.
	appliedEnrichments?: AppliedEnrichment[];
	// Transient: set client-side in the combined "All" view so a row knows it came from the
	// resolved list and can route its own actions. Not persisted.
	isResolved?: boolean;
	ownerId?: string | null;
}

// A reference to an enrichment rule that was applied to an alert (for display in the UI).
export interface AppliedEnrichment {
	id: number;
	name: string;
}

export interface AlertHistory {
	alertId: string;
	data: AlertHistoryData[];
}

// The kinds of events recorded in an alert's history timeline. STATUS_CHANGED covers the
// firing/resolved transitions captured automatically; the rest are user-driven actions.
export enum AlertHistoryEventType {
	STATUS_CHANGED = 'status_changed',
	OWNER_ASSIGNED = 'owner_assigned',
	OWNER_UNASSIGNED = 'owner_unassigned',
	// The persisted values stay 'dismissed'/'undismissed' (the feature's old name) so
	// existing history rows keep resolving to these events.
	SILENCED = 'dismissed',
	UNSILENCED = 'undismissed',
	// A user manually resolved the alert. API-driven resolution (the source reporting the
	// alert as recovered) shows up as an automatic STATUS_CHANGED entry instead.
	RESOLVED = 'resolved',
	UNRESOLVED = 'unresolved',
	ACTION_RUN = 'action_run',
	COMMENT_ADDED = 'comment_added',
	// Synthesized (not persisted): the alert's most recent update from its source,
	// derived from updated_at at read time. Guarantees a visible alert always has at
	// least one history entry inside any time window that shows it.
	UPDATED = 'updated',
}

export interface AlertHistoryData {
	date: string;
	// Present for status transitions (kept for backward compatibility with status-only history).
	status?: AlertStatus;
	// What kind of event this entry records. Legacy status-only entries are treated as STATUS_CHANGED.
	eventType?: AlertHistoryEventType;
	// Display name of the user who performed the action (absent for automatic/system events).
	actorName?: string;
	// Human-readable description, e.g. "Assigned to Idan" or "Ran action 'Notify #oncall'".
	description?: string;
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

export enum AuditActionType {
	CREATE = 'CREATE',
	UPDATE = 'UPDATE',
	DELETE = 'DELETE',
}

export enum AuditResourceType {
	PROVIDER = 'PROVIDER',
	SERVICE = 'SERVICE',
	USER = 'USER',
	DASHBOARD = 'DASHBOARD',
	SECRET = 'SECRET',
	ENRICHMENT = 'ENRICHMENT',
	ACTION = 'ACTION',
	// Add more as needed
}

export interface AuditLog {
	id: number;
	actionType: AuditActionType;
	resourceType: AuditResourceType;
	resourceId: string;
	userId: number;
	timestamp: string;
	resourceName: string;
	userName: string;
	details?: string;
}

export type SecretMetadata = {
	id: number;
	name: string;
	fileName: string;
	type: SecretType;
};

export interface ServiceCustomField {
	id: number;
	name: string;
	createdAt: string;
}

export interface ServiceCustomFieldValue {
	serviceId: number;
	customFieldId: number;
	value: string;
	createdAt: string;
	updatedAt: string;
}

export interface ResetPassword {
	id: number;
	userId: number;
	tokenHash: string;
	expiresAt: string;
	createdAt: string;
}

export interface ResetPasswordType {
	userId: number;
	tokenHash: string;
	expiresAt: Date;
}

// Serialized time filter persisted with a dashboard. Dates are stored as ISO
// strings so the range survives the wire and the DB; `preset` mirrors the
// client TimeRange preset ('last1h', 'custom', ...).
export interface DashboardTimeRange {
	from: string | null;
	to: string | null;
	preset: string | null;
}

export interface Dashboard {
	id: string;
	type: 'services' | 'alerts';
	name: string;
	description?: string;
	filters: Record<string, unknown>;
	visibleColumns: string[];
	// User-arranged column order for the alerts table (base columns; tag-key columns
	// follow the visible list). Absent on dashboards saved before reordering shipped.
	columnOrder?: string[];
	query: string;
	groupBy: string[];
	timeRange?: DashboardTimeRange;
	createdAt?: string;
}

export interface AlertComment {
	id: string;
	alertId: string;
	userId: string;
	comment: string;
	createdAt: string;
	updatedAt: string;
}

export interface MutePolicyLabelMatcher {
	key: string;
	value: string;
	// How the value compares against the alert's tag: exact equality (default) or
	// case-insensitive substring. Absent = equals, so every stored row keeps meaning
	// what it meant.
	op?: 'equals' | 'contains';
}

// OR groups of label matchers: an entity matches an alert when ANY group matches, and a
// group matches when EVERY matcher in it equals the alert's tag value (AND within a
// group, OR between groups). The legacy flat labelMatchers list is equivalent to a
// single group; helpers below normalize both shapes.
export type LabelMatcherGroups = MutePolicyLabelMatcher[][];

export interface MatcherCriteria {
	labelMatchers?: MutePolicyLabelMatcher[] | null;
	labelMatcherGroups?: LabelMatcherGroups | null;
}

// The entity's effective OR groups: explicit groups win; a legacy flat list folds into
// one group; empty rows are dropped so blank editor lines never block a match.
export const getLabelMatcherGroups = (criteria: MatcherCriteria): LabelMatcherGroups => {
	const groups = (criteria.labelMatcherGroups ?? [])
		.map((group) => (group ?? []).filter((m) => m && m.key))
		.filter((group) => group.length > 0);
	if (groups.length > 0) return groups;
	const flat = (criteria.labelMatchers ?? []).filter((m) => m && m.key);
	return flat.length > 0 ? [flat] : [];
};

const matcherMatchesTagValue = (m: MutePolicyLabelMatcher, tagValue: string | undefined): boolean => {
	if (tagValue === undefined) return false;
	if (m.op === 'contains') return String(tagValue).toLowerCase().includes(m.value.toLowerCase());
	return String(tagValue) === m.value;
};

export const anyMatcherGroupMatchesTags = (
	groups: LabelMatcherGroups,
	tags: Record<string, string> | undefined
): boolean => groups.some((group) => group.every((m) => matcherMatchesTagValue(m, tags?.[m.key])));

// Recurring weekly schedule, evaluated in server local time.
// daysOfWeek: 0=Sunday … 6=Saturday (matches Date.prototype.getDay()).
// startTime/endTime: "HH:MM" 24h. endTime must be strictly greater than startTime
// (overnight windows must be split into two mute policies).
export interface MutePolicySchedule {
	daysOfWeek: number[];
	startTime: string;
	endTime: string;
}

export interface MutePolicy {
	id: number;
	name: string;
	nameContains?: string | null;
	labelMatchers: MutePolicyLabelMatcher[];
	// OR groups (see LabelMatcherGroups); when present they supersede labelMatchers,
	// which then carries the first group for backward compatibility.
	labelMatcherGroups?: LabelMatcherGroups;
	// Match every alert, ignoring name/label criteria entirely.
	matchAll?: boolean;
	startsAt?: string | null;
	endsAt?: string | null;
	schedule?: MutePolicySchedule | null;
	reason?: string | null;
	createdAt: string;
	updatedAt: string;
}

// Alert enrichment: a rule that matches alerts (like mute policies: name-contains + label matchers)
// and decorates them at fetch time — adding/overriding tag fields and/or rewriting the summary.
// The summary template may reference the current values via {{summary}}, {{name}}, {{status}}.
// Applied transiently when alerts are fetched; nothing is persisted on the alert itself.
export interface AlertEnrichmentField {
	key: string;
	value: string;
}

export interface AlertEnrichment {
	id: number;
	name: string;
	nameContains?: string | null;
	labelMatchers: MutePolicyLabelMatcher[];
	// OR groups (see LabelMatcherGroups); when present they supersede labelMatchers.
	labelMatcherGroups?: LabelMatcherGroups;
	// Match every alert, ignoring name/label criteria entirely.
	matchAll?: boolean;
	addFields: AlertEnrichmentField[];
	// Links appended to matching alerts' link collection. Label and url are templated
	// like field values ({{label.<key>}} etc.); icon is a slug from the integration
	// icon set, '' for the generic link icon.
	addLinks?: AlertLink[];
	summaryTemplate?: string | null;
	// Rank: rules apply highest-priority first. When two rules set the same field the higher
	// priority wins; summary templates chain in priority order. Ties break by creation order.
	priority: number;
	// Display name of the user who created the rule / last edited it (null for legacy rows).
	createdBy?: string | null;
	lastModifiedBy?: string | null;
	createdAt: string;
	updatedAt: string;
}

// Actions are reusable, user-configured integrations that can be run against an alert
// (e.g. notify a Slack/Teams channel, open a Jira ticket, or fire an arbitrary HTTP request).
// This phase only covers configuring them; wiring them to alerts comes later.
export type ActionType = 'slack' | 'teams' | 'jira' | 'http';

export type HttpActionMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface SlackActionConfig {
	webhookUrl: string;
	channel?: string | null;
	messageTemplate?: string | null;
}

export interface TeamsActionConfig {
	webhookUrl: string;
	titleTemplate?: string | null;
	messageTemplate?: string | null;
}

export interface JiraActionConfig {
	baseUrl: string;
	email: string;
	apiToken: string;
	projectKey: string;
	issueType: string;
	summaryTemplate?: string | null;
	descriptionTemplate?: string | null;
}

export interface HttpActionConfig {
	url: string;
	method: HttpActionMethod;
	headers?: Record<string, string> | null;
	bodyTemplate?: string | null;
}

export type ActionConfig = SlackActionConfig | TeamsActionConfig | JiraActionConfig | HttpActionConfig;

export interface ActionLabelMatcher {
	key: string;
	value: string;
}

export interface Action {
	id: number;
	name: string;
	type: ActionType;
	config: ActionConfig;
	// Optional alert filter. When both nameContains and labelMatchers are empty, the action
	// applies to all alerts. Otherwise it only shows on alerts whose name contains nameContains
	// (when set) AND whose tags match every label matcher.
	nameContains?: string | null;
	labelMatchers: ActionLabelMatcher[];
	// OR groups (see LabelMatcherGroups); when present they supersede labelMatchers.
	labelMatcherGroups?: LabelMatcherGroups;
	createdAt: string;
	updatedAt: string;
}

// Result of running ("testing") an action against sample data.
export interface ActionTestResult {
	ok: boolean;
	statusCode?: number;
	message: string;
}

// Preview of the exact content that would be sent for an action, with templates already
// resolved against a specific alert. The editable text fields vary by action type; the
// remaining fields are read-only destination context shown to the user.
export interface SlackActionPreview {
	type: 'slack';
	message: string;
	channel?: string | null;
	webhookUrl: string;
}
export interface TeamsActionPreview {
	type: 'teams';
	title: string;
	message: string;
	webhookUrl: string;
}
export interface JiraActionPreview {
	type: 'jira';
	summary: string;
	description: string;
	baseUrl: string;
	projectKey: string;
	issueType: string;
}
export interface HttpActionPreview {
	type: 'http';
	method: HttpActionMethod;
	url: string;
	body: string;
}
export type ActionPreview = SlackActionPreview | TeamsActionPreview | JiraActionPreview | HttpActionPreview;

// User-edited text fields sent back when running an action, overriding the rendered templates.
export interface ActionOverrides {
	message?: string;
	title?: string;
	summary?: string;
	description?: string;
	body?: string;
}

// ==================== Data Retention ====================

// The data categories whose old rows can be auto-deleted by the retention job. The string
// values are stable keys used by the API and persisted config (not raw table names).
export enum RetentionResource {
	AuditLogs = 'audit_logs',
	AlertHistoryEvents = 'alert_history_events',
	AlertStatusHistory = 'alert_status_history',
	// Active (non-resolved) alerts. Aged by last-updated time, so stale alerts that never resolve
	// (e.g. a source that stopped sending) get cleaned while genuinely-active ones are spared.
	ActiveAlerts = 'active_alerts',
	ResolvedAlerts = 'archived_alerts',
	AlertComments = 'alert_comments',
}

export interface RetentionPolicy {
	resourceType: RetentionResource;
	// When enabled, rows older than retentionDays are deleted by the cleanup job.
	enabled: boolean;
	retentionDays: number;
	updatedAt: string;
}

// The one update shape shared by the API layer, hooks and BL for silence-reset settings;
// UpdateSilenceResetSettingsSchema (schemas.ts) is its validating counterpart.
export interface UpdateSilenceResetSettings {
	enabled?: boolean;
	// Hour of day (0-23, server-local time).
	hour?: number;
}

// Org-wide daily silence reset: at `hour` (server-local time) every silenced alert flips
// back to alerting, regardless of the duration originally chosen. Off by default.
export interface SilenceResetSettings {
	enabled: boolean;
	// Hour of day (0-23, server-local time) at which all silences clear.
	hour: number;
	// ISO timestamp of the reset occurrence most recently applied (null if never).
	lastClearedAt: string | null;
}

export interface RetentionConfig {
	// How often the cleanup job runs.
	cleanupIntervalHours: number;
	// When true, run VACUUM after a cleanup that deleted rows, to return freed disk space to the
	// OS (plain DELETE only frees pages inside the file for reuse — the file never shrinks).
	vacuumAfterCleanup: boolean;
	// ISO timestamp of the last completed cleanup run (null if never run).
	lastRunAt: string | null;
}

export interface RetentionSettings {
	config: RetentionConfig;
	policies: RetentionPolicy[];
}

// Result of a cleanup run: how many rows were deleted per resource, and whether the file was
// compacted afterwards.
export interface RetentionRunResult {
	ranAt: string;
	deleted: Partial<Record<RetentionResource, number>>;
	vacuumed: boolean;
}
