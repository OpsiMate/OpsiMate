import { z } from 'zod';
import {
	DatadogAlertWebhookSchema,
	GcpAlertWebhookSchema,
	GrafanaWebhookSchema,
	HttpAlertWebhookSchema,
	UptimeKumaWebhookPayloadSchema,
	ZabbixWebhookPayloadSchema,
} from '../../v1/alerts/models';
import { ApiRouteDoc, errors } from '../registry';
import { WebhookAcceptedSchema } from '../schemas';

const TOKEN_NOTE =
	'Authenticate with the instance API token: the `x-api-token` header, or `?api_token=` in the URL ' +
	'for senders that can only call a plain URL.';

// The runtime schema accepts any `status` on purpose (it used to be ignored, and senders
// already put values like "active" there); the docs describe what it means.
const CustomAlertBodySchema = HttpAlertWebhookSchema.extend({
	status: z
		.string()
		.optional()
		.describe('"resolved" (any letter case) resolves the alert with this id; anything else, or nothing, fires it'),
}).meta({
	id: 'CustomAlert',
	examples: [
		{
			id: 'checkout-api-latency',
			alertName: 'Checkout API p99 latency above 2s',
			tags: { service: 'checkout', env: 'production', team: 'payments' },
			severity: 'critical',
			summary: 'p99 latency has been above 2s for 5 minutes',
			links: [{ label: 'Dashboard', icon: 'grafana', url: 'https://grafana.example.com/d/checkout' }],
		},
	],
});

// A resolve needs nothing but the id (HttpAlertWebhookHeadSchema is what the server reads first).
const CustomResolveBodySchema = z
	.object({
		id: z.string(),
		status: z.string().describe('"resolved", in any letter case'),
	})
	.meta({ id: 'CustomAlertResolve', examples: [{ id: 'checkout-api-latency', status: 'resolved' }] });

const CustomWebhookBodySchema = z.union([CustomAlertBodySchema, CustomResolveBodySchema]);

const accepted = {
	200: { description: 'Accepted', schema: WebhookAcceptedSchema },
	400: errors.validation,
	401: errors.unauthorized,
};

export const webhookRoutes: ApiRouteDoc[] = [
	{
		method: 'post',
		path: '/api/v1/alerts/custom',
		tag: 'Webhooks',
		summary: 'Send an alert (custom webhook)',
		description:
			'Creates or updates the alert with this `id` (sending the same id again updates it), or resolves it ' +
			'with `"status": "resolved"` — a resolve needs only `id` and `status`.\n\n' +
			'A resolve for an alert OpsiMate never saw firing is recorded as a resolved episode when the body is a ' +
			'full alert (id, alertName, tags); an id-only resolve of an unknown alert is a no-op.\n\n' +
			TOKEN_NOTE,
		auth: 'user',
		body: CustomWebhookBodySchema,
		responses: accepted,
	},
	{
		method: 'post',
		path: '/api/v1/alerts/custom/grafana',
		tag: 'Webhooks',
		summary: 'Grafana alerting webhook',
		description:
			'Point a Grafana webhook contact point here. Firing and resolved notifications are both handled. ' +
			TOKEN_NOTE,
		auth: 'user',
		body: GrafanaWebhookSchema,
		responses: accepted,
	},
	{
		method: 'post',
		path: '/api/v1/alerts/custom/datadog',
		tag: 'Webhooks',
		summary: 'Datadog webhook',
		description:
			'Use the payload template from the Datadog integration setup in OpsiMate. "Recovered" transitions ' +
			'resolve the alert. ' +
			TOKEN_NOTE,
		auth: 'user',
		body: DatadogAlertWebhookSchema,
		responses: accepted,
	},
	{
		method: 'post',
		path: '/api/v1/alerts/custom/gcp',
		tag: 'Webhooks',
		summary: 'Google Cloud Monitoring webhook',
		description: 'Add this URL as a Webhook notification channel. ' + TOKEN_NOTE,
		auth: 'user',
		body: GcpAlertWebhookSchema,
		responses: accepted,
	},
	{
		method: 'post',
		path: '/api/v1/alerts/custom/uptimekuma',
		tag: 'Webhooks',
		summary: 'Uptime Kuma webhook',
		description:
			'A monitor going down fires an alert; coming back up resolves it. Uptime Kuma\'s "Test" button is ' +
			'accepted and stores nothing. ' +
			TOKEN_NOTE,
		auth: 'user',
		body: UptimeKumaWebhookPayloadSchema,
		responses: accepted,
	},
	{
		method: 'post',
		path: '/api/v1/alerts/custom/zabbix',
		tag: 'Webhooks',
		summary: 'Zabbix webhook',
		description: 'Problem events fire an alert; recovery events resolve it. ' + TOKEN_NOTE,
		auth: 'user',
		body: ZabbixWebhookPayloadSchema,
		responses: accepted,
	},
];
