import { Request, Response } from 'express';
import { AlertStatus, Logger } from '@OpsiMate/shared';
import { AlertBL } from '../../../bl/alerts/alert.bl';
import { DatadogAlertWebhookSchema, GcpAlertWebhook, HttpAlertWebhookSchema, UptimeKumaWebhookPayload } from './models';
import { isZodError } from '../../../utils/isZodError.ts';
import { v4 } from 'uuid';

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

	async dismissAlert(req: Request, res: Response) {
		try {
			const { id } = req.params;
			if (!id) {
				return res.status(400).json({ success: false, error: 'Alert id is required' });
			}
			const alert = await this.alertBL.dismissAlert(id);
			if (!alert) {
				return res.status(404).json({ success: false, error: 'Alert not found' });
			}
			return res.json({ success: true, data: { alert } });
		} catch (error) {
			logger.error('Error dismissing alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async undismissAlert(req: Request, res: Response) {
		try {
			const { id } = req.params;
			if (!id) {
				return res.status(400).json({ success: false, error: 'Alert id is required' });
			}
			const alert = await this.alertBL.undismissAlert(id);
			if (!alert) {
				return res.status(404).json({ success: false, error: 'Alert not found' });
			}
			return res.json({ success: true, data: { alert } });
		} catch (error) {
			logger.error('Error undismissing alert:', error);
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
				await this.alertBL.archiveAlert(monitorId);

				return res.status(200).json({
					success: true,
					data: { alertId: monitorId, archived: true },
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

	async createCustomGCPAlert(req: Request, res: Response) {
		try {
			const payload = req.body as GcpAlertWebhook;
			const incident = payload.incident;
			if (!incident) {
				return res.status(400).json({ error: 'Missing incident in payload' });
			}

			logger.info(`got gcp alert: ${JSON.stringify(payload)}`);

			if (incident.state.toLowerCase() === 'closed') {
				await this.alertBL.archiveAlert(incident.incident_id);
			} else {
				await this.alertBL.insertOrUpdateAlert({
					id: incident.incident_id,
					type: 'GCP',
					status: AlertStatus.FIRING,
					tags: incident.policy_user_labels || {},
                    startsAt: this.normalizeDate(incident.started_at),
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
			const status = payload.alert_status?.toLowerCase() ?? '';

			const isRecovered =
				transition.includes('recovered') || status === 'ok' || status === 'recovered' || status === 'resolved';

			logger.info(`got datadog alert: ${JSON.stringify(payload)}`);

			if (isRecovered) {
				await this.alertBL.archiveAlert(alertId);
				return res.status(200).json({ success: true, data: { alertId } });
			}

			const now = new Date().toISOString();

			const startsAtSource = payload.date ?? payload.last_updated ?? now;
			const updatedAtSource = payload.last_updated ?? payload.date ?? now;

			const tagsString = payload.alert_scope || payload.tags || '';
			const primaryTag = tagsString.split(',')[0]?.trim();

			await this.alertBL.insertOrUpdateAlert({
				id: alertId,
				type: 'Datadog',
				status: AlertStatus.FIRING,
				tag: primaryTag || 'unknown',
				startsAt: this.normalizeDate(startsAtSource),
				updatedAt: this.normalizeDate(updatedAtSource),
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

	async createCustomAlert(req: Request, res: Response) {
		try {
			const alert = HttpAlertWebhookSchema.parse(req.body);

			await this.alertBL.insertOrUpdateAlert({
				id: alert.id,
				type: 'Custom',
				status: AlertStatus.FIRING,
				tags: alert.tags,
				startsAt: alert.startsAt,
				updatedAt: alert.updatedAt,
				alertUrl: alert.alertUrl,
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

	async deleteAlert(req: Request, res: Response) {
		try {
			const alertId = req.params.alertId;
			if (alertId.length < 1) {
				return res.status(400).json({ success: false, error: 'Invalid alert ID' });
			}
			await this.alertBL.archiveAlert(alertId);
			return res.json({ success: true, message: 'Alert deleted successfully' });
		} catch (error) {
			logger.error('Error deleting alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async getArchivedAlerts(req: Request, res: Response) {
		try {
			const alerts = await this.alertBL.getAllArchivedAlerts();
			return res.json({ success: true, data: { alerts } });
		} catch (error) {
			logger.error('Error getting archived alerts:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	async deleteArchivedAlert(req: Request, res: Response) {
		try {
			const alertId = req.params.alertId;
			if (alertId.length < 1) {
				return res.status(400).json({ success: false, error: 'Invalid alert ID' });
			}
			await this.alertBL.deleteArchivedAlert(alertId);
			return res.json({ success: true, message: 'Archived alert deleted permanently' });
		} catch (error) {
			logger.error('Error deleting archived alert:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}

	private normalizeDate(value: number | string): string {
		// If null/undefined → fallback
		if (value === null || value === undefined || value === '') {
			return new Date().toISOString();
		}

		// Helper to normalize a numeric epoch that may be in seconds or milliseconds
		const fromEpoch = (epoch: number): string => {
			// Heuristic: values < 1e12 are treated as seconds; >= 1e12 as milliseconds
			const asMs = epoch < 1e12 ? epoch * 1000 : epoch;
			const date = new Date(asMs);
			return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
		};

		// If it's a number (epoch seconds or millis)
		if (typeof value === 'number') {
			return fromEpoch(value);
		}

		// If it's a numeric string (e.g. "1763324240" or "1764869846000")
		if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) {
			const num = Number(value);
			if (!Number.isNaN(num)) {
				return fromEpoch(num);
			}
		}

		// If it's an ISO-like string or other date-parseable format, try parsing
		const iso = new Date(value);
		if (!isNaN(iso.getTime())) {
			return iso.toISOString();
		}

		// Fallback
		return new Date().toISOString();
	}
}
