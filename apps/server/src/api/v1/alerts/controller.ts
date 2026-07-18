import { Request, Response } from 'express';
import { AlertHistory, AlertStatus, CreateCommentSchema, Logger, UpdateCommentSchema } from '@OpsiMate/shared';
import { AlertBL } from '../../../bl/alerts/alert.bl';
import {
	DatadogAlertWebhookSchema,
	GcpAlertWebhook,
	GrafanaWebhookSchema,
	HttpAlertWebhookSchema,
	SetAlertOwnerSchema,
	UptimeKumaWebhookPayload,
	ZabbixWebhookPayload,
} from './models';
import { isZodError } from '../../../utils/isZodError.ts';
import { v4 } from 'uuid';
import { createHash } from 'crypto';
import { AuthenticatedRequest } from '../../../middleware/auth.ts';

const logger: Logger = new Logger('alerts.controller');

export class AlertController {
	constructor(private alertBL: AlertBL) {}

	async getAlerts(req: Request, res: Response) {
		try {
			const alerts = await this.alertBL.getAllAlerts();
			return res.json({ success: true, data: { alerts } });
		} catch (error) {
			logger.error('Error getting alerts:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async silenceAlert(req: AuthenticatedRequest, res: Response) {
		try {
			const { id } = req.params;
			if (!id) {
				return res.status(400).json({ success: false, error: 'Alert id is required' });
			}
			const alert = await this.alertBL.silenceAlert(id, req.user?.fullName);
			if (!alert) {
				return res.status(404).json({ success: false, error: 'Alert not found' });
			}
			return res.json({ success: true, data: { alert } });
		} catch (error) {
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
					id: v4(),
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
					id: v4(),
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
			});

			return res.status(200).json({ success: true, data: { alertId } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
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
				});
				processedIds.push(alertId);
			}

			return res.status(200).json({ success: true, data: { processed: processedIds } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
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
				tags: alert.tags,
				startsAt: alert.startsAt || new Date().toISOString(),
				updatedAt: alert.updatedAt || new Date().toISOString(),
				alertUrl: alert.alertUrl || '',
				alertName: alert.alertName,
				summary: alert.summary,
				runbookUrl: alert.runbookUrl,
			});
			return res.status(200).json({ success: true, data: { alertId: alert.id } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
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
			// This endpoint is the UI's "Resolve" action — a manual resolve, recorded with
			// the acting user (unlike the integration webhooks, which resolve without one).
			await this.alertBL.resolveAlert(alertId, req.user?.fullName ?? null);
			return res.json({ success: true, message: 'Alert deleted successfully' });
		} catch (error) {
			logger.error('Error deleting alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async getResolvedAlerts(req: Request, res: Response) {
		try {
			const alerts = await this.alertBL.getAllResolvedAlerts();
			return res.json({ success: true, data: { alerts } });
		} catch (error) {
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
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
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

			const newComment = await this.alertBL.createComment({
				alertId: alertId,
				userId: req.user.id,
				comment: comment,
			});

			return res.status(201).json({ success: true, data: { comment: newComment } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
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
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
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
