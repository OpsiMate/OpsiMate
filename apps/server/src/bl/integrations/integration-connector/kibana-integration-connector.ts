import { Integration, IntegrationUrls, Logger } from '@OpsiMate/shared';
import { IntegrationConnector } from './integration-connector';
import { DashboardResult, KibanaClient } from '../../../dal/external-client/kibana-client';
import { AlertBL } from '../../alerts/alert.bl';

export class KibanaIntegrationConnector implements IntegrationConnector {
	private logger = new Logger('bl/integrations/kibana-integration-connector');

	async getUrls(integration: Integration, tags: string[]): Promise<IntegrationUrls[]> {
		try {
			if (!integration.credentials || !integration.credentials['apiKey']) {
				this.logger.error('Missing Kibana API apiKey in credentials');
				return [];
			}

			const kibanaClient = new KibanaClient(integration.externalUrl, integration.credentials['apiKey']);

			// Process all tags in parallel and collect dashboards
			const dashboardPromises: Promise<IntegrationUrls[]>[] = tags.map(async (tag: string) => {
				try {
					const dashboards = await kibanaClient.searchDashboardsByTag(tag);
					this.logger.info(`Found ${dashboards.length} dashboards with tag '${tag}'`);

					// Transform dashboards to KibanaDashboard format
					return dashboards.map((dash: DashboardResult) => ({
						name: dash.title,
						url: `${integration.externalUrl.replace(/\/$/, '')}${dash.url}`,
					}));
				} catch (error) {
					this.logger.error(`Error fetching Kibana dashboards for tag ${tag}:`, error);
					return []; // Return empty array for failed tags
				}
			});

			// Wait for all dashboard requests to complete
			const dashboardResults = await Promise.all(dashboardPromises);

			// Flatten results and remove duplicates based on URL
			return dashboardResults.flat();
		} catch (error) {
			this.logger.error('Error in KibanaIntegrationConnector.getUrls:', error);
			return [];
		}
	}

	async deleteData(_: Integration, _2: AlertBL): Promise<void> {}
}
