/* eslint-disable @typescript-eslint/no-misused-promises */
import {IntegrationType, Logger} from '@OpsiMate/shared';
import {TagRepository} from '../dal/tagRepository.js';
import {GrafanaClient} from '../dal/external-client/grafana-client.js';
import {AlertBL} from "../bl/alerts/alert.bl.js";
import {IntegrationBL} from "../bl/integrations/integration.bl.js";


const logger = new Logger('pull-grafana-alerts-job');

export class PullGrafanaAlertsJob {
    constructor(private alertBL: AlertBL, private integrationBL: IntegrationBL, private tagRepo: TagRepository) {
    }

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
        try {

            const grafana = await this.integrationBL.getIntegrationByType(IntegrationType.Grafana);
            if (!grafana) return;

            const token = grafana.credentials["apiKey"] as string;
            if (!token) {
                logger.warn(`No token for Grafana integration ${grafana.name}`);
                return;
            }

            const tagNames = (await this.tagRepo.getAllTags()).map(t => t.name);
            const client = new GrafanaClient(grafana.externalUrl, token);


            const alerts = await client.getAlerts(tagNames);

            const keepIds: string[] = [];


            for (const a of alerts) {
                const tagName = a.labels?.tag || '';
                if (!tagName) continue;

                let serviceIds: number[] = [];
                try {
                    serviceIds = await this.tagRepo.findServiceIdsByTagName(tagName);
                } catch (e) {
                    logger.error(`Tag→services failed for tag="${tagName}"`, e);
                    continue;
                }
                if (serviceIds.length === 0) continue;

                for (const sid of serviceIds) {
                    const id = `${a.fingerprint}:${sid}`;
                    try {
                        await this.alertBL.insertOrUpdateAlert({
                            id,
                            status: a.status?.state || '',
                            tag: tagName, // or another label key if appropriate
                            starts_at: a.startsAt ? new Date(a.startsAt).toISOString() : '',
                            updated_at: a.updatedAt ? new Date(a.updatedAt).toISOString() : '', // if available
                            alert_url: a.generatorURL || '',// or the correct field for the alert URL
                            alert_name: a.labels?.rulename || a.labels?.alertname || a.annotations?.summary || '',
                            summary: a.annotations?.summary || '',
                            runbook_url: a.annotations?.runbook_url || '',
                            service_id: sid,
                        });
                        keepIds.push(id);
                    } catch (e) {
                        logger.error(`Upsert failed for id=${id}`, e);
                    }
                }
            }


            try {
                const resolved = await this.alertBL.deleteAlertsNotInIds(keepIds);
                logger.info(`resolved ${resolved.changes} alerts`);
            } catch (e) {
                logger.error('Cleanup failed', e);
            }

        } catch (e) {
            logger.error('[Job] pullGrafanaAlerts failed', e);
        }
    }
}
