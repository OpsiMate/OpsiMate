export enum ProviderType {
	VM = 'VM',
	K8S = 'K8S',
}

// Client-side provider types for UI configuration
export type ClientProviderType =
	| 'server'
	| 'kubernetes'
	| 'aws-ec2'
	| 'aws-eks'
	| 'gcp-compute'
	| 'gcp-gke'
	| 'azure-vm'
	| 'azure-aks';

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
// fall back to the default (warning) so every alert always has a severity.
export function normalizeAlertSeverity(value?: string | null): AlertSeverity {
	if (!value) return DEFAULT_ALERT_SEVERITY;
	return SEVERITY_SYNONYMS[value.trim().toLowerCase()] ?? DEFAULT_ALERT_SEVERITY;
}

export interface Alert {
	id: string;
	type: AlertType;
	status: AlertStatus;
	// Always present on API responses; alerts sent without one default to warning.
	severity: AlertSeverity;
	tags: Record<string, string>;
	startsAt: string;
	updatedAt: string;
	alertUrl: string;
	alertName: string;
	summary?: string;
	runbookUrl?: string;
	createdAt: string;
	isDismissed: boolean;
	// False until someone opens the alert; unread alerts render bold in the table.
	isRead?: boolean;
	// Transient: set at fetch time when an active silence rule matches this alert. Not persisted.
	isSilenced?: boolean;
	// Transient: set at fetch time with the enrichment rules that matched/decorated this alert.
	// Empty/undefined means the alert was not enriched. Not persisted.
	appliedEnrichments?: AppliedEnrichment[];
	// Transient: set client-side in the combined "All" view so a row knows it came from the
	// archived list and can route its own actions. Not persisted.
	isArchived?: boolean;
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
	DISMISSED = 'dismissed',
	UNDISMISSED = 'undismissed',
	ACTION_RUN = 'action_run',
	COMMENT_ADDED = 'comment_added',
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

export interface Dashboard {
	id: string;
	type: 'services' | 'alerts';
	name: string;
	description?: string;
	filters: Record<string, unknown>;
	visibleColumns: string[];
	query: string;
	groupBy: string[];
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

export interface AlertSilenceLabelMatcher {
	key: string;
	value: string;
}

// Recurring weekly schedule, evaluated in server local time.
// daysOfWeek: 0=Sunday … 6=Saturday (matches Date.prototype.getDay()).
// startTime/endTime: "HH:MM" 24h. endTime must be strictly greater than startTime
// (overnight windows must be split into two silences).
export interface AlertSilenceSchedule {
	daysOfWeek: number[];
	startTime: string;
	endTime: string;
}

export interface AlertSilence {
	id: number;
	name: string;
	nameContains?: string | null;
	labelMatchers: AlertSilenceLabelMatcher[];
	startsAt?: string | null;
	endsAt?: string | null;
	schedule?: AlertSilenceSchedule | null;
	reason?: string | null;
	createdAt: string;
	updatedAt: string;
}

// Alert enrichment: a rule that matches alerts (like silences: name-contains + label matchers)
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
	labelMatchers: AlertSilenceLabelMatcher[];
	addFields: AlertEnrichmentField[];
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
	// Active (non-archived) alerts. Aged by last-updated time, so stale alerts that never resolve
	// (e.g. a source that stopped sending) get cleaned while genuinely-active ones are spared.
	ActiveAlerts = 'active_alerts',
	ArchivedAlerts = 'archived_alerts',
	AlertComments = 'alert_comments',
}

export interface RetentionPolicy {
	resourceType: RetentionResource;
	// When enabled, rows older than retentionDays are deleted by the cleanup job.
	enabled: boolean;
	retentionDays: number;
	updatedAt: string;
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
