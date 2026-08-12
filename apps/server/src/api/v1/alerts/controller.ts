import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import {
	AlertHistory,
	AlertLink,
	AlertStatus,
	CreateCommentSchema,
	Logger,
	Role,
	UpdateCommentSchema,
	UpdateSilenceResetSettingsSchema,
} from '@OpsiMate/shared';
import { AlertBL } from '../../../bl/alerts/alert.bl';
import {
	DatadogAlertWebhookSchema,
	GcpAlertWebhook,
	GrafanaWebhookSchema,
	HttpAlertWebhookSchema,
	SetAlertOwnerSchema,
	ResolveAlertBodySchema,
	SilenceAlertBodySchema,
	UptimeKumaWebhookPayload,
	ZabbixWebhookPayload,
} from './models';
import { isZodError } from '../../../utils/isZodError.ts';
import { ifNoneMatchSatisfied } from '../../../utils/etag';
import crypto from 'crypto';
import { ALERT_QUERY_PARAM_KEYS, AlertFacetsParamsSchema, AlertListQueryParamsSchema } from './models';
import { createHash } from 'crypto';
import { AuthenticatedRequest } from '../../../middleware/auth.ts';

const logger: Logger = new Logger('alerts.controller');

const hasAlertQueryParams = (req: Request): boolean =>
	ALERT_QUERY_PARAM_KEYS.some((key) => req.query[key] !== undefined);

export class AlertController {
	constructor(private alertBL: AlertBL) {}

	async getAlerts(req: Request, res: Response) {
		try {
			if (hasAlertQueryParams(req)) {
				const query = AlertListQueryParamsSchema.parse(req.query);
				const page = await this.alertBL.queryAlerts(query);
				return this.sendAlertsPage(req, res, page);
			}
			const snapshot = await this.alertBL.getAlertsSnapshot();
			return this.sendAlertsSnapshot(req, res, snapshot);
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error getting alerts:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async getAlertFacets(req: Request, res: Response) {
		try {
			const params = AlertFacetsParamsSchema.parse(req.query);
			const result = await this.alertBL.getAlertFacets(params.filters ?? {}, params.fields);
			return res.json({ success: true, data: result });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error computing alert facets:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async getResolvedAlertFacets(req: Request, res: Response) {
		try {
			const params = AlertFacetsParamsSchema.parse(req.query);
			const result = await this.alertBL.getResolvedAlertFacets(params.filters ?? {}, params.fields);
			return res.json({ success: true, data: result });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error computing resolved alert facets:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	// Paged responses get the same revalidation contract as the snapshot: the ETag is
	// content-derived, so an unchanged page (the common poll) is a bodyless 304.
	private sendAlertsPage(
		req: Request,
		res: Response,
		page: { items: unknown[]; total: number; nextCursor: string | null }
	) {
		const body = JSON.stringify({
			success: true,
			data: { alerts: page.items, total: page.total, nextCursor: page.nextCursor },
		});
		const etag = `"${crypto.createHash('sha1').update(body).digest('hex')}"`;
		res.set('ETag', etag);
		res.set('Cache-Control', 'no-cache');
		if (ifNoneMatchSatisfied(req.headers['if-none-match'], etag)) {
			return res.status(304).end();
		}
		return res.type('application/json').send(body);
	}

	// The list is identical for every viewer and polled on a short interval, so the
	// content-derived ETag turns the common "nothing changed since your last poll" case
	// into a bodyless 304. The body string is assembled from the snapshot's precomputed
	// JSON — one serialization per compute, not one per poller.
	private sendAlertsSnapshot(req: Request, res: Response, snapshot: { json: string; etag: string }) {
		res.set('ETag', snapshot.etag);
		// Polling data: always revalidate, never reuse blind.
		res.set('Cache-Control', 'no-cache');
		if (ifNoneMatchSatisfied(req.headers['if-none-match'], snapshot.etag)) {
			return res.status(304).end();
		}
		return res.type('application/json').send(`{"success":true,"data":{"alerts":${snapshot.json}}}`);
	}

	// Both silence-reset endpoints are admin-only: this is org-wide configuration, same
	// gate the retention settings use.
	private requireAdmin(req: AuthenticatedRequest, res: Response): boolean {
		if (!req.user || req.user.role !== Role.Admin) {
			res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
			return false;
		}
		return true;
	}

	async getSilenceResetSettings(req: AuthenticatedRequest, res: Response) {
		if (!this.requireAdmin(req, res)) return;
		try {
			const settings = await this.alertBL.getSilenceResetSettings();
			return res.json({ success: true, data: settings });
		} catch (error) {
			logger.error('Error getting silence reset settings:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async updateSilenceResetSettings(req: AuthenticatedRequest, res: Response) {
		if (!this.requireAdmin(req, res)) return;
		try {
			const updates = UpdateSilenceResetSettingsSchema.parse(req.body ?? {});
			const settings = await this.alertBL.updateSilenceResetSettings(updates);
			return res.json({ success: true, data: settings });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error updating silence reset settings:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async silenceAlert(req: AuthenticatedRequest, res: Response) {
		try {
			const { id } = req.params;
			if (!id) {
				return res.status(400).json({ success: false, error: 'Alert id is required' });
			}
			const { silencedUntil, comment } = SilenceAlertBodySchema.parse(req.body ?? {});
			const alert = await this.alertBL.silenceAlert(
				id,
				// String() — the JWT carries the id as a number; comments store it as TEXT.
				{ id: req.user != null ? String(req.user.id) : null, name: req.user?.fullName ?? null },
				silencedUntil ?? null,
				comment
			);
			if (!alert) {
				return res.status(404).json({ success: false, error: 'Alert not found' });
			}
			return res.json({ success: true, data: { alert } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error silencing alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async unsilenceAlert(req: AuthenticatedRequest, res: Response) {
		try {
			const { id } = req.params;
			if (!id) {
				return res.status(400).json({ success: false, error: 'Alert id is required' });
			}
			const alert = await this.alertBL.unsilenceAlert(id, req.user?.fullName);
			if (!alert) {
				return res.status(404).json({ success: false, error: 'Alert not found' });
			}
			return res.json({ success: true, data: { alert } });
		} catch (error) {
			logger.error('Error unsilenceing alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async createUptimeKumaAlert(req: Request, res: Response) {
		try {
			const payload = req.body as UptimeKumaWebhookPayload;

			if (!payload?.heartbeat || !payload?.monitor) {
				logger.info('UptimeKuma Test Alert Created');
				await this.alertBL.insertOrUpdateAlert({
					id: randomUUID(),
					type: 'UptimeKuma',
					status: AlertStatus.FIRING,
					tags: {},
					startsAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					alertUrl: '',
					alertName: 'Test Alert',
					summary: 'Test Alert by UptimeKuma was created successfully',
					runbookUrl: undefined,
				});

				return res.status(200).json({ success: true, data: null });
			}

			const { heartbeat, monitor } = payload;
			const monitorId = `UPTIMEKUMA_${String(monitor.id)}`;
			const kumaStatus = heartbeat.status;

			logger.info(`Received Uptime Kuma alert: ${JSON.stringify(payload)}`);

			if (kumaStatus === 1) {
				await this.alertBL.resolveAlert(monitorId);

				return res.status(200).json({
					success: true,
					data: { alertId: monitorId, resolved: true },
				});
			}

			// Status 0 or 2 = DOWN/PENDING → active alert
			const startsAt = new Date(heartbeat.time).toISOString();
			const updatedAt = new Date().toISOString();

			const tags: Record<string, string> = {};
			for (const tag of monitor.tags) {
				tags[tag.name] = tag.value || 'unknown';
			}

			await this.alertBL.insertOrUpdateAlert({
				id: monitorId,
				type: 'UptimeKuma',
				status: AlertStatus.FIRING,
				tags: tags,
				startsAt,
				updatedAt,
				alertUrl: '',
				alertName: monitor.pathName || monitor.name || 'UNKNOWN',
				summary: heartbeat.msg || payload.msg || 'No summary provided.',
				runbookUrl: undefined,
			});

			return res.status(200).json({
				success: true,
				data: { alertId: monitorId, updated: true },
			});
		} catch (error) {
			logger.error('Error while handling Uptime Kuma alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async createZabbixAlert(req: Request, res: Response) {
		try {
			const payload = req.body as ZabbixWebhookPayload;

			logger.info(`Received Zabbix alert: ${JSON.stringify(payload)}`);

			// Handle test alert (no event_id)
			if (!payload.event_id && !payload.trigger_id) {
				logger.info('Zabbix Test Alert Created');
				await this.alertBL.insertOrUpdateAlert({
					id: randomUUID(),
					type: 'Zabbix',
					status: AlertStatus.FIRING,
					tags: {},
					startsAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					alertUrl: '',
					alertName: 'Test Alert',
					summary: 'Test Alert from Zabbix was created successfully',
					runbookUrl: undefined,
				});
				return res.status(200).json({ success: true, data: null });
			}

			const alertId = `ZABBIX_${payload.event_id || payload.trigger_id}`;

			// Check if this is a recovery/resolved event
			// event_value: "0" = resolved, "1" = problem
			// trigger_status: "OK" = resolved, "PROBLEM" = active
			// Note: Unexpanded Zabbix macros like {EVENT.RECOVERY.DATE} should not be treated as valid values
			const hasValidRecoveryDate =
				payload.event_recovery_date &&
				!payload.event_recovery_date.startsWith('{') &&
				payload.event_recovery_date.trim() !== '';
			const hasValidRecoveryTime =
				payload.event_recovery_time &&
				!payload.event_recovery_time.startsWith('{') &&
				payload.event_recovery_time.trim() !== '';

			const isResolved =
				payload.event_value === '0' ||
				payload.trigger_status?.toUpperCase() === 'OK' ||
				(hasValidRecoveryDate && hasValidRecoveryTime);

			if (isResolved) {
				await this.alertBL.resolveAlert(alertId);
				return res.status(200).json({
					success: true,
					data: { alertId, resolved: true },
				});
			}

			// Parse event date/time
			let startsAt = new Date().toISOString();
			if (payload.event_date && payload.event_time) {
				try {
					startsAt = new Date(`${payload.event_date} ${payload.event_time}`).toISOString();
				} catch {
					startsAt = new Date().toISOString();
				}
			}

			// Parse tags from event_tags (format: "tag1:value1,tag2:value2")
			const tags: Record<string, string> = {};
			if (payload.event_tags) {
				payload.event_tags.split(',').forEach((tag) => {
					const [key, value] = tag.split(':').map((s) => s.trim());
					if (key) {
						tags[key] = value || 'true';
					}
				});
			}

			// Add severity as a tag
			if (payload.trigger_severity) {
				tags['severity'] = payload.trigger_severity;
			}

			// Add host info as tags
			if (payload.host_name) {
				tags['host'] = payload.host_name;
			}
			if (payload.host_ip) {
				tags['host_ip'] = payload.host_ip;
			}

			const alertName = payload.trigger_name || payload.event_name || 'Unknown Zabbix Alert';
			const summary =
				payload.alert_message ||
				`${payload.trigger_name || ''} on ${payload.host_name || 'unknown host'}${payload.item_value ? ` - Value: ${payload.item_value}` : ''}`;

			// Build alert URL from Zabbix
			// Priority: trigger_url (from {TRIGGER.URL} macro) > constructed URL from zabbix_url + event_id
			let alertUrl = '';
			if (payload.trigger_url && !payload.trigger_url.startsWith('{')) {
				alertUrl = payload.trigger_url;
			} else if (payload.zabbix_url && payload.event_id) {
				// Construct URL to the problem in Zabbix
				const baseUrl = payload.zabbix_url.replace(/\/$/, ''); // Remove trailing slash
				alertUrl = `${baseUrl}/tr_events.php?triggerid=${payload.trigger_id}&eventid=${payload.event_id}`;
			}

			await this.alertBL.insertOrUpdateAlert({
				id: alertId,
				type: 'Zabbix',
				status: AlertStatus.FIRING,
				tags,
				startsAt,
				updatedAt: new Date().toISOString(),
				alertUrl,
				alertName,
				summary,
				runbookUrl: undefined,
			});

			return res.status(200).json({
				success: true,
				data: { alertId, updated: true },
			});
		} catch (error) {
			logger.error('Error while handling Zabbix alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async createCustomGCPAlert(req: Request, res: Response) {
		try {
			const payload = req.body as GcpAlertWebhook;
			const incident = payload.incident;
			if (!incident) {
				return res.status(400).json({ error: 'Missing incident in payload' });
			}

			logger.info(`got gcp alert: ${JSON.stringify(payload)}`);

			if (incident.state.toLowerCase() === 'closed') {
				await this.alertBL.resolveAlert(incident.incident_id);
			} else {
				await this.alertBL.insertOrUpdateAlert({
					id: incident.incident_id,
					type: 'GCP',
					status: AlertStatus.FIRING,
					tags: incident.policy_user_labels || {},
					startsAt: this.normalizeGCPDate(incident.started_at),
					updatedAt: new Date().toISOString(),
					alertUrl: incident.url,
					alertName: incident.policy_name || 'UNKNOWN',
					summary: incident.summary || 'No summary provided for this alert.',
					runbookUrl: incident.documentation?.content,
					links: AlertController.buildLinks([
						{ label: 'View incident', icon: 'gcp', url: incident.url },
						// documentation.content is free-form text; only URL-shaped content
						// ever produced a working runbook button.
						{ label: 'Documentation', icon: '', url: incident.documentation?.content },
					]),
				});
			}
			return res.status(200).json({ success: true, data: { alertId: incident.incident_id } });
		} catch (error) {
			logger.error('Error creating gcp alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async createCustomDatadogAlert(req: Request, res: Response) {
		try {
			const payload = DatadogAlertWebhookSchema.parse(req.body);

			const alertId = payload.id;

			// Determine whether this is a recovery / resolved transition
			const transition = payload.alert_transition?.toLowerCase() ?? '';
			const isRecovered = transition.includes('recovered');

			logger.info(`got datadog alert: ${JSON.stringify(payload)}`);

			if (isRecovered) {
				await this.alertBL.resolveAlert(alertId);
				return res.status(200).json({ success: true, data: { alertId } });
			}

			const now = new Date().toISOString();

			const startsAtSource = payload.date ?? payload.last_updated ?? now;
			const updatedAtSource = payload.last_updated ?? payload.date ?? now;

			const tags = Object.fromEntries(
				payload.tags
					?.split(',')
					.map((tag) => tag.split(':'))
					.filter((pair): pair is [string, string] => pair.length === 2) ?? []
			);

			await this.alertBL.insertOrUpdateAlert({
				id: alertId,
				type: 'Datadog',
				status: AlertStatus.FIRING,
				// Datadog monitor priority (P1–P5); the ingestion funnel normalizes it
				// (P1 → critical, …) unless an explicit severity tag is present.
				severity: tags['severity'] ?? payload.priority,
				tags,
				startsAt: new Date(Number(startsAtSource)).toISOString(),
				updatedAt: new Date(Number(updatedAtSource)).toISOString(),
				alertUrl: payload.link ?? '',
				alertName: payload.title || 'UNKNOWN',
				summary: payload.message,
				runbookUrl: undefined,
				links: AlertController.buildLinks([{ label: 'View in Datadog', icon: 'datadog', url: payload.link }]),
			});

			return res.status(200).json({ success: true, data: { alertId } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error creating datadog alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	// Grafana labels that are internal/system metadata and should not become alert tags.
	private static GRAFANA_LABELS_TO_IGNORE = new Set([
		'__alert_rule_uid__',
		'__grafana_autogenerated__',
		'__grafana_receiver__',
		'alertname',
		'datasource_uid',
		'grafana_folder',
		'ref_id',
		'rulename',
	]);

	// Stable, collision-resistant id derived from an alert's full label set. Used only as a
	// fallback when Grafana omits the fingerprint, so distinct instances of the same rule (which
	// share alertname/rulename but differ in their labels) never collapse onto one alert record.
	// Builds an alert's links collection from candidate entries: drops empty and
	// non-http(s) urls, dedupes by url (integrations often repeat the same URL across
	// payload fields), and returns undefined when nothing survives so the client's
	// legacy alertUrl/runbookUrl fold-in still applies.
	private static buildLinks(
		candidates: Array<{ label: string; icon: string; url?: string | null }>
	): AlertLink[] | undefined {
		const seen = new Set<string>();
		const links: AlertLink[] = [];
		for (const { label, icon, url } of candidates) {
			if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
			seen.add(url);
			links.push({ label, icon, url });
		}
		return links.length ? links : undefined;
	}

	private static idFromLabels(labels: Record<string, string>): string {
		const normalized = Object.keys(labels)
			.sort()
			.map((k) => `${k}=${labels[k]}`)
			.join('\n');
		return `grafana-${createHash('sha1').update(normalized).digest('hex').slice(0, 16)}`;
	}

	// Parses a timestamp to ISO, falling back to "now" when it is missing or unparseable, so a
	// malformed startsAt from Grafana can't throw and drop the whole batch.
	private static toIsoOrNow(value?: string): string {
		if (!value) return new Date().toISOString();
		const parsed = new Date(value);
		return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
	}

	// Receives alerts pushed by a Grafana "Webhook" contact point. Replaces the old polling job:
	// Grafana now POSTs firing/resolved transitions here. Each alert in the batch is upserted
	// (firing) or resolved (resolved), keyed by Grafana's per-alert fingerprint.
	async createCustomGrafanaAlert(req: Request, res: Response) {
		try {
			const payload = GrafanaWebhookSchema.parse(req.body);
			const alerts = payload.alerts ?? [];
			logger.info(`Got grafana webhook with ${alerts.length} alert(s)`);

			const processedIds: string[] = [];

			for (const alert of alerts) {
				const labels = alert.labels || {};
				// Grafana's fingerprint uniquely identifies an alert instance. When it is absent
				// (rare), derive a per-instance id from the full label set rather than the rule
				// name, so different instances of the same rule never collapse onto one record.
				const alertId =
					alert.fingerprint || (Object.keys(labels).length > 0 ? AlertController.idFromLabels(labels) : '');
				if (!alertId) {
					logger.warn('Skipping grafana alert without fingerprint or labels');
					continue;
				}

				if (alert.status?.toLowerCase() === 'resolved') {
					await this.alertBL.resolveAlert(alertId);
					processedIds.push(alertId);
					continue;
				}

				const tags = Object.fromEntries(
					Object.entries(labels).filter(([key]) => !AlertController.GRAFANA_LABELS_TO_IGNORE.has(key))
				);

				// Grafana sends up to three distinct URLs; the legacy alertUrl kept only the
				// first non-empty one. The links collection surfaces them all (deduped —
				// Grafana often repeats the same URL across fields).
				const links = AlertController.buildLinks([
					{ label: 'View in Grafana', icon: 'grafana', url: alert.generatorURL },
					{ label: 'Dashboard', icon: 'grafana', url: alert.dashboardURL },
					{ label: 'Panel', icon: 'grafana', url: alert.panelURL },
					{ label: 'Runbook', icon: '', url: alert.annotations?.runbook_url },
				]);

				await this.alertBL.insertOrUpdateAlert({
					id: alertId,
					type: 'Grafana',
					status: AlertStatus.FIRING,
					tags,
					startsAt: AlertController.toIsoOrNow(alert.startsAt),
					updatedAt: new Date().toISOString(),
					alertUrl: alert.generatorURL || alert.dashboardURL || alert.panelURL || '',
					alertName: labels.rulename || labels.alertname || alert.annotations?.summary || 'Grafana alert',
					summary: alert.annotations?.summary || alert.annotations?.description || '',
					runbookUrl: alert.annotations?.runbook_url || '',
					links,
				});
				processedIds.push(alertId);
			}

			return res.status(200).json({ success: true, data: { processed: processedIds } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error creating grafana alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async createCustomAlert(req: Request, res: Response) {
		try {
			const alert = HttpAlertWebhookSchema.parse(req.body);

			await this.alertBL.insertOrUpdateAlert({
				id: alert.id,
				type: 'Custom',
				status: AlertStatus.FIRING,
				severity: alert.severity,
				team: alert.team,
				// The fix field rides on the fix tag (the client's first-class Fix column
				// reads it from there); an explicit tag wins over the convenience field.
				tags: alert.fix && !('fix' in alert.tags) ? { ...alert.tags, fix: alert.fix } : alert.tags,
				startsAt: alert.startsAt || new Date().toISOString(),
				updatedAt: alert.updatedAt || new Date().toISOString(),
				alertUrl: alert.alertUrl || '',
				alertName: alert.alertName,
				summary: alert.summary,
				runbookUrl: alert.runbookUrl,
				links: alert.links,
			});
			return res.status(200).json({ success: true, data: { alertId: alert.id } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			} else {
				logger.error('Error creating integration:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	}

	async markAlertRead(req: Request, res: Response) {
		try {
			const alertId = req.params.id;
			if (!alertId) {
				return res.status(400).json({ success: false, error: 'Invalid alert ID' });
			}
			const alert = await this.alertBL.markAlertRead(alertId);
			if (!alert) {
				return res.status(404).json({ success: false, error: 'Alert not found' });
			}
			return res.json({ success: true, data: { alert } });
		} catch (error) {
			logger.error('Error marking alert as read:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async deleteAlert(req: AuthenticatedRequest, res: Response) {
		try {
			const alertId = req.params.alertId;
			if (alertId.length < 1) {
				return res.status(400).json({ success: false, error: 'Invalid alert ID' });
			}
			const { comment } = ResolveAlertBodySchema.parse(req.body ?? {});
			// This endpoint is the UI's "Resolve" action — a manual resolve, recorded with
			// the acting user (unlike the integration webhooks, which resolve without one).
			// The resolver becomes the alert's owner, and an optional resolve note is stored
			// as a regular comment.
			await this.alertBL.resolveAlert(
				alertId,
				// String() — the JWT carries the id as a number; comments store it as TEXT.
				{ id: req.user != null ? String(req.user.id) : null, name: req.user?.fullName ?? null },
				comment
			);
			return res.json({ success: true, message: 'Alert deleted successfully' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error deleting alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async getResolvedAlerts(req: Request, res: Response) {
		try {
			if (hasAlertQueryParams(req)) {
				const query = AlertListQueryParamsSchema.parse(req.query);
				const page = await this.alertBL.queryResolvedAlerts(query);
				return this.sendAlertsPage(req, res, page);
			}
			const snapshot = await this.alertBL.getResolvedAlertsSnapshot();
			return this.sendAlertsSnapshot(req, res, snapshot);
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error getting resolved alerts:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async unresolveAlert(req: AuthenticatedRequest, res: Response) {
		try {
			const alertId = req.params.id;
			if (!alertId) {
				return res.status(400).json({ success: false, error: 'Alert id is required' });
			}
			const alert = await this.alertBL.unresolveAlert(alertId, req.user?.fullName);
			if (!alert) {
				return res.status(404).json({ success: false, error: 'Resolved alert not found' });
			}
			return res.json({ success: true, data: { alert } });
		} catch (error) {
			logger.error('Error unresolving alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async deleteResolvedAlert(req: Request, res: Response) {
		try {
			const alertId = req.params.alertId;
			if (alertId.length < 1) {
				return res.status(400).json({ success: false, error: 'Invalid alert ID' });
			}
			await this.alertBL.deleteResolvedAlert(alertId);
			return res.json({ success: true, message: 'Resolved alert deleted permanently' });
		} catch (error) {
			logger.error('Error deleting resolved alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async getAlertHistory(req: Request, res: Response) {
		try {
			const alertId = req.params.alertId;
			if (alertId.length < 1) {
				return res.status(400).json({ success: false, error: 'Invalid alert ID' });
			}
			const alertHistory: AlertHistory = await this.alertBL.getAlertHistory(alertId);
			return res.json({ success: true, data: { ...alertHistory } });
		} catch (error) {
			logger.error('Error getting alert history:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async setAlertOwner(req: AuthenticatedRequest, res: Response) {
		return this.setAlertOwnerWrapper(req, res, false);
	}

	async setResolvedAlertOwner(req: AuthenticatedRequest, res: Response) {
		return this.setAlertOwnerWrapper(req, res, true);
	}

	async setAlertOwnerWrapper(req: AuthenticatedRequest, res: Response, isResolved: boolean) {
		try {
			const { id } = req.params;
			if (!id) {
				return res.status(400).json({ success: false, error: 'Alert id is required' });
			}
			const { ownerId } = SetAlertOwnerSchema.parse(req.body);
			const alert = await this.alertBL.setAlertOwner(id, ownerId, isResolved, req.user?.fullName);
			if (!alert) {
				return res.status(404).json({ success: false, error: 'Alert not found' });
			}
			return res.json({ success: true, data: { alert } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error setting alert owner:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	private normalizeGCPDate(value: number | string): string {
		// If null/undefined → fallback
		if (!value) return new Date().toISOString();

		// If it's a number (unix seconds)
		if (typeof value === 'number') {
			return new Date(value * 1000).toISOString();
		}

		// If it's a numeric string (e.g. "1763324240" or "1763324240.0")
		if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) {
			return new Date(Number(value) * 1000).toISOString();
		}

		// If it's an ISO-like string, try parsing
		const iso = new Date(value);
		if (!isNaN(iso.getTime())) {
			return iso.toISOString();
		}

		// Fallback
		return new Date().toISOString();
	}

	// region Alert Comments
	async getCommentsByAlertId(req: Request, res: Response) {
		try {
			const { alertId } = req.params;
			if (!alertId) {
				return res.status(400).json({ success: false, error: 'Alert id is required' });
			}
			const comments = await this.alertBL.getCommentsByAlertId(alertId);
			return res.json({ success: true, data: { comments } });
		} catch (error) {
			logger.error('Error getting comments:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async createComment(req: AuthenticatedRequest, res: Response) {
		try {
			const { alertId } = req.params;
			if (!alertId) {
				return res.status(400).json({ success: false, error: 'Alert id is required' });
			}
			if (!req.user) {
				return res.status(400).json({ success: false, error: 'user id is required' });
			}

			const { comment } = CreateCommentSchema.parse(req.body);

			const newComment = await this.alertBL.createComment(
				{
					alertId: alertId,
					userId: req.user.id,
					comment: comment,
				},
				req.user.fullName ?? null
			);

			return res.status(201).json({ success: true, data: { comment: newComment } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error creating comment:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async updateComment(req: AuthenticatedRequest, res: Response) {
		try {
			const { commentId } = req.params;
			if (!commentId) {
				return res.status(400).json({ success: false, error: 'Comment id is required' });
			}
			if (!req.user) {
				return res.status(400).json({ success: false, error: 'user id is required' });
			}

			const { comment } = UpdateCommentSchema.parse(req.body);

			const updatedComment = await this.alertBL.updateComment(commentId, req.user.id, comment);
			if (!updatedComment) {
				return res.status(404).json({ success: false, error: 'Comment not found' });
			}

			return res.json({ success: true, data: { comment: updatedComment } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error updating comment:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async deleteComment(req: AuthenticatedRequest, res: Response) {
		try {
			const { commentId } = req.params;
			if (!commentId) {
				return res.status(400).json({ success: false, error: 'Comment id is required' });
			}
			if (!req.user) {
				return res.status(400).json({ success: false, error: 'user id is required' });
			}

			await this.alertBL.deleteComment(commentId, req.user.id);
			return res.json({ success: true, message: 'Comment deleted successfully' });
		} catch (error) {
			logger.error('Error deleting comment:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}
	// endregion
}
