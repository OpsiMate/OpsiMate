/* eslint-disable @typescript-eslint/no-misused-promises */
import {IntegrationType, Logger, Tag} from '@OpsiMate/shared';
import {TagRepository} from '../dal/tagRepository.js';
import {GrafanaClient} from '../dal/external-client/grafana-client.js';
import {AlertBL} from "../bl/alerts/alert.bl.js";
import {IntegrationBL} from "../bl/integrations/integration.bl.js";

const logger = new Logger('pull-grafana-alerts-job');

export class PullGrafanaAlertsJob {
    constructor(private alertBL: AlertBL, private integrationBL: IntegrationBL,private  tagRepo: TagRepository) {}

    startPullGrafanaAlertsJob = () => {
        logger.info('[Job] Starting refreshAllProvidersServices job (every 10 minutes)');

        // Run immediately on startup (optional)
        this.pullGrafanaAlerts().catch((err) =>
            logger.error('[Job] Initial run failed:', err)
        );

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
        const grafanaIntegration = await this.integrationBL.getIntegrationByType(IntegrationType.Grafana);
        if (!grafanaIntegration) {
            return;
        }

        const tags: Tag[] = await this.tagRepo.getAllTags();
        const tagNames = tags.map(t => t.name);

        const token = grafanaIntegration.credentials["apiKey"] as string

        if (!token) {
            logger.warn(`No token for Grafana integration ${grafanaIntegration.name}`);
            return;
        }
        const client = new GrafanaClient(grafanaIntegration.externalUrl, token);

        const alerts = await client.getAlerts(tagNames);

        // Store each alert
        for (const alert of alerts) {
            try {
                await this.alertBL.insertOrUpdateAlert({
                    id: alert.fingerprint,
                    status: alert.status?.state || '',
                    tag: alert.labels?.tag || '', // or another label key if appropriate
                    starts_at: alert.startsAt ? new Date(alert.startsAt).toISOString() : '',
                    updated_at: alert.updatedAt ? new Date(alert.updatedAt).toISOString() : '', // if available
                    alert_url: alert.generatorURL || '', // or the correct field for the alert URL
                    alert_name: alert.labels?.rulename || alert.labels?.alertname || alert.annotations?.summary || '',
                    summary: alert.annotations?.summary || '',
                    runbook_url: alert.annotations?.runbook_url || '',
                });
            } catch (err) {
                logger.error('Failed to insert alert', err);
            }
        }

        const resolvedAlerts = await this.alertBL.deleteAlertsNotInIds(alerts.map(alert => alert.fingerprint));
        logger.info(`resolved ${resolvedAlerts.changes} alerts`);

    }
}
