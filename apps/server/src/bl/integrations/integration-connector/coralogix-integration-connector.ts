import { Integration, IntegrationUrls, Logger } from '@OpsiMate/shared';
import { IntegrationConnector } from './integration-connector';
import { CoralogixClient, CoralogixDashboardSummary } from '../../../dal/external-client/coralogix-client';
import { AlertBL } from '../../alerts/alert.bl';

export class CoralogixIntegrationConnector implements IntegrationConnector {
	private readonly logger = new Logger('bl/integrations/coralogix-integration-connector');

	async getUrls(integration: Integration, tags: string[]): Promise<IntegrationUrls[]> {
		try {
			// Skip if no tags provided
			if (!tags || tags.length === 0) {
				this.logger.info('No tags provided for Coralogix integration, skipping');
				return [];
			}

			// Check if credentials exist and have the required fields
			if (!integration.credentials || !integration.credentials['apiKey']) {
				this.logger.error('Missing Coralogix API key in credentials');
				return [];
			}

			const coralogixClient = new CoralogixClient(
				integration.externalUrl,
				integration.credentials['apiKey']
			);

			// Get dashboards matching the provided tags
			const dashboards = await coralogixClient.getDashboardsByTags(tags);
			this.logger.info(`Found ${dashboards.length} Coralogix dashboards matching tags: ${tags.join(', ')}`);

			// Transform dashboards to IntegrationUrls format
			return dashboards
				.filter((dash: CoralogixDashboardSummary) => !!dash.url) // Filter out dashboards without URLs
				.map((dash: CoralogixDashboardSummary) => ({
					name: dash.name,
					url: dash.url as string, // The URL is already absolute from the CoralogixClient
				}));
		} catch (error) {
			this.logger.error('Error in CoralogixIntegrationConnector.getUrls:', error);
			return [];
		}
	}

	async deleteData(_: Integration, _2: AlertBL): Promise<void> {}
}
