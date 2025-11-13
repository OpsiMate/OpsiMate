/* eslint-disable @typescript-eslint/no-misused-promises */
import { IntegrationType, Logger } from '@OpsiMate/shared';
import { GrafanaClient } from '../dal/external-client/grafana-client';
import { AlertBL } from '../bl/alerts/alert.bl';
import { IntegrationBL } from '../bl/integrations/integration.bl';

const logger = new Logger('pull-grafana-alerts-job');

export class PullGrafanaAlertsJob {
	constructor(
		private alertBL: AlertBL,
		private integrationBL: IntegrationBL
	) {}

	startPullGrafanaAlertsJob = () => {
		logger.info('[Job] Starting refreshAllProvidersServices job (every 10 minutes)');

		// Run immediately on startup (optional)
		this.pullGrafanaAlerts().catch((err) => logger.error('[Job] Initial run failed:', err));

		// Then run every 10 minutes
		setInterval(async () => {
			logger.info('[Job] Running refreshAllProvidersServices');
			try {
				await this.pullGrafanaAlerts();
			} catch (err) {
				logger.error('[Job] Failed to refresh services:', err);
			}
		}, 10 * 1000);
	};

	private async pullGrafanaAlerts() {
		try {
			const grafana = await this.integrationBL.getIntegrationByType(IntegrationType.Grafana);
			if (!grafana) return;

			const token = grafana.credentials['apiKey'] as string;
			if (!token) {
				logger.warn(`No token for Grafana integration ${grafana.name}`);
				return;
			}

			const client = new GrafanaClient(grafana.externalUrl, token);
			const grafanaAlerts = await client.getAlerts();
			const activeAlertIds = new Set(grafanaAlerts.map((a) => a.fingerprint));
			await this.alertBL.deleteAlertsNotInIds(activeAlertIds, 'Grafana');

			for (const alert of grafanaAlerts) {
				try {
					const tagName = alert.labels?.tag || '';
					await this.alertBL.insertOrUpdateAlert({
						id: alert.fingerprint,
						type: 'Grafana',
						status: alert.status?.state || '',
						tag: tagName, // or another label key if appropriate
						starts_at: alert.startsAt ? new Date(alert.startsAt).toISOString() : '',
						updated_at: alert.updatedAt ? new Date(alert.updatedAt).toISOString() : '', // if available
						alert_url: alert.generatorURL || '', // or the correct field for the alert URL
						alert_name:
							alert.labels?.rulename || alert.labels?.alertname || alert.annotations?.summary || '',
						summary: alert.annotations?.summary || '',
						runbook_url: alert.annotations?.runbook_url || '',
					});
				} catch (e) {
					logger.error(`Upsert failed for id=${alert.fingerprint}`, e);
				}
			}
		} catch (e) {
			logger.error('[Job] pullGrafanaAlerts failed', e);
		}
	}
}
