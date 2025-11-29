import { Request, Response } from 'express';
import { AlertStatus, Logger } from '@OpsiMate/shared';
import { AlertBL } from '../../../bl/alerts/alert.bl';
import { GcpAlertWebhook, HttpAlertWebhookSchema, UptimeKumaWebhookPayload } from './models';
import { isZodError } from '../../../utils/isZodError.ts';

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
				return res.status(400).json({ error: 'Invalid Uptime Kuma payload' });
			}

			const { heartbeat, monitor } = payload;
			const monitorId = `UPKUMA_${String(monitor.id)}`;
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

			await this.alertBL.insertOrUpdateAlert({
				id: monitorId,
				type: 'UptimeKuma',
				status: AlertStatus.FIRING,
				tag: monitor.name ?? 'UptimeKuma',
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
					tag: incident.resource_name,
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

	async createCustomAlert(req: Request, res: Response) {
		try {
			const alert = HttpAlertWebhookSchema.parse(req.body);

			await this.alertBL.insertOrUpdateAlert({
				id: alert.id,
				type: 'Custom',
				status: AlertStatus.FIRING,
				tag: alert.tag,
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
}
