import { Request, Response } from 'express';
import { Logger } from '@OpsiMate/shared';
import { AlertBL } from '../../../bl/alerts/alert.bl';
import { GcpAlertWebhook, HttpAlertWebhookSchema } from './models';
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

	async createCustomGCPAlert(req: Request, res: Response) {
		try {
			const payload = req.body as GcpAlertWebhook;
			const incident = payload.incident;
			if (!incident) {
				return res.status(400).json({ error: 'Missing incident in payload' });
			}

			logger.info(`got gcp alert: ${JSON.stringify(payload)}`);

			if (incident.state.toLowerCase() === 'closed') {
				await this.alertBL.deleteAlert(incident.incident_id);
			} else {
				await this.alertBL.insertOrUpdateAlert({
					id: incident.incident_id,
					type: 'GCP',
					status: incident.state,
					tag: incident.resource_name || 'unknown',
					starts_at: this.normalizeGCPDate(incident.started_at),
					updated_at: new Date().toISOString(),
					alert_url: incident.url || 'unknown',
					alert_name: incident.policy_name || 'unknown',
					summary: incident.summary || 'unknown',
					runbook_url: incident.documentation?.content || 'unknown',
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
				status: alert.status,
				tag: alert.tag,
				starts_at: alert.startsAt,
				updated_at: alert.updatedAt,
				alert_url: alert.alertUrl,
				alert_name: alert.alertName,
				summary: alert.summary,
				runbook_url: alert.runbookUrl,
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
			await this.alertBL.deleteAlert(alertId);
			return res.json({ success: true, message: 'Alert deleted successfully' });
		} catch (error) {
			logger.error('Error deleting alert:', error);
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
