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

export interface Alert {
	id: string;
	type: AlertType;
	status: AlertStatus;
	tags: Record<string, string>;
	startsAt: string;
	updatedAt: string;
	alertUrl: string;
	alertName: string;
	summary?: string;
	runbookUrl?: string;
	createdAt: string;
	isDismissed: boolean;
	// Transient: set at fetch time when an active silence rule matches this alert. Not persisted.
	isSilenced?: boolean;
	ownerId?: string | null;
}

export interface AlertHistory {
	alertId: string;
	data: AlertHistoryData[];
}

export interface AlertHistoryData {
	date: string;
	status: AlertStatus;
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
