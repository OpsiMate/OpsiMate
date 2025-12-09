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

export const HttpAlertWebhookSchema = z.object({
	id: z.string(),
	tags: z.record(z.string(), z.string()),
	startsAt: isoDateString,
	updatedAt: isoDateString,
	alertUrl: z.string().url(),
	alertName: z.string(),
	summary: z.string().optional(),
	runbookUrl: z.string().url().optional(),
	createdAt: isoDateString,
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
