import { z } from 'zod';

export interface GcpAlertWebhook {
	version?: string | number;
	incident: GcpIncident;
}

export interface GcpIncident {
	policy_user_labels?: Record<string, string>;
	incident_id: string;
	resource_id?: string;
	resource_name?: string;
	policy_name?: string;
	condition_name?: string;
	state: 'open' | 'acknowledged' | 'closed';
	started_at: string | number;
	url: string;
	summary?: string;
	documentation?: {
		content?: string;
	};
}

const isoDateString = z.string().refine(
	(s) => {
		return !Number.isNaN(Date.parse(s));
	},
	{
		message: 'Invalid date string (expected ISO date/time)',
	}
);

// Attached links: label + url, with an optional icon slug matched against the client's
// integration icon set (grafana, uptimekuma, gcp, ...); '' or unknown = generic icon.
export const AlertLinkSchema = z.object({
	label: z.string().min(1),
	icon: z.string().optional(),
	url: z.string().url(),
});

export const HttpAlertWebhookSchema = z.object({
	id: z.string(),
	tags: z.record(z.string(), z.string()),
	startsAt: isoDateString.optional(),
	updatedAt: isoDateString.optional(),
	// Deprecated in favor of `links` — still accepted; folds into the links UI as the
	// "Source" entry when `links` is absent.
	alertUrl: z.string().url().optional(),
	alertName: z.string(),
	summary: z.string().optional(),
	// Deprecated in favor of `links` — still accepted; folds in as the "Runbook" entry.
	runbookUrl: z.string().url().optional(),
	links: z.array(AlertLinkSchema).max(20).optional(),
	// Fix classification: manual or auto (free-form synonyms accepted — "manual fix",
	// "autofix", "automated", ...). Stored on the fix tag; unlike severity there is no
	// default — alerts without it show no fix classification.
	fix: z.string().optional(),
	createdAt: isoDateString.optional(),
	// Free-form; normalized onto the fixed critical/warning/info scale at ingestion
	// (unknown or missing values default to warning).
	severity: z.string().optional(),
	// Owning team; falls back to a `team` tag at ingestion, null when neither is present.
	team: z.string().optional(),
});

// Optional body of the manual-resolve request (DELETE /alerts/:alertId).
export const ResolveAlertBodySchema = z.object({
	// Optional resolve note, stored as a regular alert comment by the acting user.
	comment: z.string().trim().max(5000).optional(),
});

// Optional body of the silence request (PATCH /alerts/:id/silence).
export const SilenceAlertBodySchema = z.object({
	// ISO time when the silence auto-expires; null or absent silences until manually
	// unsilenced. Always overwritten on re-silence, so the timer restarts each time.
	silencedUntil: isoDateString.nullable().optional(),
	// Optional note, stored as a regular alert comment by the acting user.
	comment: z.string().trim().max(5000).optional(),
});

/**
 * Datadog alerts webhook payload.
 *
 * This matches a recommended custom webhook payload configuration in Datadog, e.g.:
 *
 * {
 *   "title": "$EVENT_TITLE",
 *   "message": "$EVENT_MSG",
 *   "alert_id": "$ALERT_ID",
 *   "alert_transition": "$ALERT_TRANSITION",
 *   "link": "$LINK",
 *   "tags": "$TAGS",
 *   "priority": "$PRIORITY",
 *   "hostname": "$HOSTNAME",
 *   "org_name": "$ORG_NAME",
 *   "date": "$DATE",
 *   "alert_scope": "$ALERT_SCOPE",
 *   "alert_status": "$ALERT_STATUS",
 *   "event_type": "$EVENT_TYPE",
 *   "last_updated": "$LAST_UPDATED",
 *   "id": "$ID"
 * }
 */
export const DatadogAlertWebhookSchema = z
	.object({
		title: z.string(),
		id: z.string(),
		alert_id: z.string().optional(),
		message: z.string().optional(),
		alert_transition: z.string().optional(),
		link: z.string().url().optional(),
		tags: z.string().optional(),
		priority: z.string().optional(),
		hostname: z.string().optional(),
		org_name: z.string().optional(),
		date: z.string(),
		alert_scope: z.string().optional(),
		alert_status: z.string().optional(),
		event_type: z.string().optional(),
		last_updated: z.string().optional(),
		body: z.string().optional(),
		org: z.any().optional(),
	})
	.passthrough();

export type DatadogAlertWebhook = z.infer<typeof DatadogAlertWebhookSchema>;

// Payload sent by a Grafana "Webhook" contact point (unified alerting). It carries a batch of
// alerts, each with its own firing/resolved status. This matches both real notifications and
// the "Test" button payload from Grafana.
export const GrafanaWebhookAlertSchema = z
	.object({
		status: z.string(), // 'firing' | 'resolved'
		labels: z.record(z.string(), z.string()).optional(),
		annotations: z.record(z.string(), z.string()).optional(),
		startsAt: z.string().optional(),
		endsAt: z.string().optional(),
		generatorURL: z.string().optional(),
		fingerprint: z.string().optional(),
		dashboardURL: z.string().optional(),
		panelURL: z.string().optional(),
		valueString: z.string().optional(),
	})
	.passthrough();

export const GrafanaWebhookSchema = z
	.object({
		// Group-level status; per-alert status is authoritative and used for firing/resolved.
		status: z.string().optional(),
		alerts: z.array(GrafanaWebhookAlertSchema).optional(),
		commonLabels: z.record(z.string(), z.string()).optional(),
		commonAnnotations: z.record(z.string(), z.string()).optional(),
		externalURL: z.string().optional(),
		title: z.string().optional(),
		message: z.string().optional(),
	})
	.passthrough();

export type GrafanaWebhook = z.infer<typeof GrafanaWebhookSchema>;
export type GrafanaWebhookAlert = z.infer<typeof GrafanaWebhookAlertSchema>;

export const SetAlertOwnerSchema = z.object({
	ownerId: z.string().nullable(),
});

export interface UptimeKumaHeartbeat {
	monitorID: number;
	status: 0 | 1 | 2; // 0 = down, 1 = up, 2 = pending
	time: string; // "2025-11-29 15:20:31.368"
	msg: string;
	important: boolean;
	retries: number;
	timezone: string;
	timezoneOffset: string;
	localDateTime: string;
}

export interface UptimeKumaTag {
	id: number;
	name: string;
	value?: string;
}

export interface UptimeKumaMonitor {
	tags: UptimeKumaTag[];
	id: number;
	name: string;
	description: string | null;
	path: string[];
	pathName: string;
	parent: number | null;
	childrenIDs: number[];
	url: string | null;
	method: string | null;
	hostname: string | null;
	port: number | null;
	maxretries: number;
	weight: number;
	active: boolean;
	forceInactive: boolean;
	type: string;
	timeout: number;
	interval: number;
	retryInterval: number;
	resendInterval: number;
	keyword: string | null;
	invertKeyword: boolean;
	expiryNotification: boolean;
	ignoreTls: boolean;
	upsideDown: boolean;
	packetSize: number;
	maxredirects: number;
	accepted_statuscodes: string[];
	dns_resolve_type: string;
	dns_resolve_server: string;
	dns_last_result: string | null;
	docker_container: string;
	docker_host: string | null;
	proxyId: number | null;
	notificationIDList: Record<string, boolean>;
	maintenance: boolean;
	mqttTopic: string;
	mqttSuccessMessage: string;
	mqttCheckType: string;
	databaseQuery: string | null;
	authMethod: string | null;
	grpcUrl: string | null;
	grpcProtobuf: string | null;
	grpcMethod: string | null;
	grpcServiceName: string | null;
	grpcEnableTls: boolean;
	radiusCalledStationId: string | null;
	radiusCallingStationId: string | null;
	game: string | null;
	gamedigGivenPortOnly: boolean;
	httpBodyEncoding: string | null;
	jsonPath: string | null;
	expectedValue: string | null;
	kafkaProducerTopic: string | null;
	kafkaProducerBrokers: string[];
	kafkaProducerSsl: boolean;
	kafkaProducerAllowAutoTopicCreation: boolean;
	kafkaProducerMessage: string | null;
	screenshot: string | null;
	cacheBust: boolean;
	remote_browser: string | null;
	snmpOid: string | null;
	jsonPathOperator: string | null;
	snmpVersion: string;
	smtpSecurity: string | null;
	ipFamily: number | null;
	ping_numeric: boolean;
	ping_count: number;
	ping_per_request_timeout: number;
	includeSensitiveData: boolean;
}

export interface UptimeKumaWebhookPayload {
	heartbeat: UptimeKumaHeartbeat;
	monitor: UptimeKumaMonitor;
	msg: string;
}

/**
 * Zabbix webhook payload
 *
 * Zabbix sends alerts via media type webhooks. The payload structure
 * depends on the webhook configuration in Zabbix.
 *
 * Default Zabbix webhook payload (configurable in Media Type):
 * {
 *   "event_id": "{EVENT.ID}",
 *   "event_name": "{EVENT.NAME}",
 *   "host_name": "{HOST.NAME}",
 *   "host_ip": "{HOST.IP}",
 *   "trigger_id": "{TRIGGER.ID}",
 *   "trigger_name": "{TRIGGER.NAME}",
 *   "trigger_severity": "{TRIGGER.SEVERITY}",
 *   "trigger_status": "{TRIGGER.STATUS}",
 *   "event_date": "{EVENT.DATE}",
 *   "event_time": "{EVENT.TIME}",
 *   "event_value": "{EVENT.VALUE}",
 *   "event_tags": "{EVENT.TAGS}",
 *   "item_name": "{ITEM.NAME}",
 *   "item_value": "{ITEM.VALUE}",
 *   "alert_message": "{ALERT.MESSAGE}",
 *   "event_recovery_date": "{EVENT.RECOVERY.DATE}",
 *   "event_recovery_time": "{EVENT.RECOVERY.TIME}",
 *   "zabbix_url": "https://your-zabbix-server",
 *   "trigger_url": "{TRIGGER.URL}"
 * }
 */
export interface ZabbixWebhookPayload {
	event_id?: string;
	event_name?: string;
	host_name?: string;
	host_ip?: string;
	trigger_id?: string;
	trigger_name?: string;
	trigger_severity?: string;
	trigger_status?: string; // "PROBLEM" or "OK"
	event_date?: string;
	event_time?: string;
	event_value?: string; // "1" for problem, "0" for resolved
	event_tags?: string;
	item_name?: string;
	item_value?: string;
	alert_message?: string;
	event_recovery_date?: string;
	event_recovery_time?: string;
	zabbix_url?: string; // Base URL of the Zabbix server
	trigger_url?: string; // Direct URL to the trigger (from {TRIGGER.URL} macro)
	// Allow additional fields
	[key: string]: string | undefined;
}

// ---------- list-query params (Phase 1: server-side filtering/paging) ----------

// JSON-in-a-param: the sidebar filter record and the facet field list are structured
// values; encoding them as JSON strings keeps the URL contract simple and lossless
// (tag keys may contain any character, so comma-lists are not safe).
const jsonParam = <T>(parse: (raw: unknown) => T) =>
	z.string().transform((raw, ctx): T => {
		try {
			return parse(JSON.parse(raw));
		} catch {
			ctx.addIssue({ code: 'custom', message: 'invalid JSON parameter' });
			return z.NEVER;
		}
	});

export const FiltersParamSchema = jsonParam((value) => z.record(z.string(), z.array(z.string())).parse(value));
const FieldsParamSchema = jsonParam((value) => z.array(z.string()).parse(value));

export const AlertListQueryParamsSchema = z.object({
	filters: FiltersParamSchema.optional(),
	// Unparseable datetimes must be a 400, not a silently-empty 200 page.
	from: z.iso.datetime({ offset: true }).optional(),
	to: z.iso.datetime({ offset: true }).optional(),
	search: z.string().optional(),
	sort: z.string().optional(),
	dir: z.enum(['asc', 'desc']).optional(),
	limit: z.coerce.number().int().min(1).max(1000).optional(),
	cursor: z.string().optional(),
});

// Insights endpoint params. from<=to is enforced here so the handler never sees an
// inverted window.
export const AlertAnalyticsParamsSchema = z
	.object({
		from: z.iso.datetime({ offset: true }).optional(),
		to: z.iso.datetime({ offset: true }).optional(),
		tz: z.string().max(64).optional(),
		filters: FiltersParamSchema.optional(),
		search: z.string().optional(),
	})
	.refine((params) => !params.from || !params.to || Date.parse(params.from) <= Date.parse(params.to), {
		message: 'from must not be after to',
	});

export const AlertFacetsParamsSchema = z.object({
	filters: FiltersParamSchema.optional(),
	fields: FieldsParamSchema.optional(),
});

export const AlertGroupsParamsSchema = z.object({
	groupBy: FieldsParamSchema,
	filters: FiltersParamSchema.optional(),
	from: z.iso.datetime({ offset: true }).optional(),
	to: z.iso.datetime({ offset: true }).optional(),
	search: z.string().optional(),
	// The viewer's IANA timezone, so date grouping buckets by THEIR day boundaries.
	timeZone: z.string().max(64).optional(),
});

// Any of these present means the caller speaks the query contract; none means the
// legacy full-snapshot response (older clients, playground harnesses).
export const ALERT_QUERY_PARAM_KEYS = ['filters', 'from', 'to', 'search', 'sort', 'dir', 'limit', 'cursor'] as const;

// ---------- bulk actions (Phase 2b: act on every alert matching a filter) ----------

// One request mutates many active alerts at once — scoped either by an explicit id list
// (the loaded selection, one request instead of N) or by the same query shape the list
// endpoints speak (filters + time window + search), which the server resolves against
// the full dataset. Exactly one scope must be present: accepting both would leave it
// ambiguous which set the caller meant to act on.
export const AlertBulkActionSchema = z
	.object({
		action: z.enum(['silence', 'unsilence', 'resolve', 'assignOwner', 'comment']),
		ids: z.array(z.string().min(1)).min(1).max(10000).optional(),
		query: z
			.object({
				filters: z.record(z.string(), z.array(z.string())).optional(),
				from: z.iso.datetime({ offset: true }).optional(),
				to: z.iso.datetime({ offset: true }).optional(),
				search: z.string().optional(),
			})
			.optional(),
		// silence: ISO auto-expiry; null or absent silences until manually unsilenced.
		silencedUntil: isoDateString.nullable().optional(),
		// silence/resolve: optional note stored as a comment on every alert.
		// comment action: the comment body itself (required there).
		comment: z.string().trim().max(5000).optional(),
		// assignOwner: numeric user id to assign (the DB stores owners as integers, and
		// a non-numeric string would parseInt to NaN), null to unassign.
		ownerId: z.string().regex(/^\d+$/, 'ownerId must be a numeric user id').nullable().optional(),
	})
	.refine((v) => (v.ids != null) !== (v.query != null), {
		message: 'Provide exactly one of ids or query',
	})
	.refine((v) => v.action !== 'comment' || (v.comment != null && v.comment.length > 0), {
		message: 'The comment action requires a non-empty comment',
	})
	.refine((v) => v.action !== 'assignOwner' || v.ownerId !== undefined, {
		message: 'The assignOwner action requires ownerId (null to unassign)',
	});

export type AlertBulkAction = z.infer<typeof AlertBulkActionSchema>;
