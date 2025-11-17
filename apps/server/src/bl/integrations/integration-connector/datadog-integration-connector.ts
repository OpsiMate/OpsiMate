import { Integration, IntegrationUrls, Logger } from '@OpsiMate/shared';
import { IntegrationConnector } from './integration-connector';
import { DatadogClient, DatadogDashboardSummary } from '../../../dal/external-client/datadog-client';
import { AlertBL } from '../../alerts/alert.bl';

export class DatadogIntegrationConnector implements IntegrationConnector {
	private logger = new Logger('bl/integrations/datadog-integration-connector');

	async getUrls(integration: Integration, tags: string[]): Promise<IntegrationUrls[]> {
		try {
			// Skip if no tags provided
			if (!tags || tags.length === 0) {
				this.logger.info('No tags provided for Datadog integration, skipping');
				return [];
			}

			// Check if credentials exist and have the required fields
			if (!integration.credentials || !integration.credentials['apiKey'] || !integration.credentials['appKey']) {
				this.logger.error('Missing Datadog API key or Application key in credentials');
				return [];
			}

			const datadogClient = new DatadogClient(
				integration.externalUrl,
				integration.credentials['apiKey'],
				integration.credentials['appKey']
			);

			// Get dashboards matching the provided tags
			const dashboards = await datadogClient.getDashboardsByTags(tags);
			this.logger.info(`Found ${dashboards.length} Datadog dashboards matching tags: ${tags.join(', ')}`);

			// Transform dashboards to IntegrationUrls format
			return dashboards
				.filter((dash: DatadogDashboardSummary) => !!dash.url) // Filter out dashboards without URLs
				.map((dash: DatadogDashboardSummary) => ({
					name: dash.title,
					url: dash.url as string, // The URL is already absolute from the DatadogClient
				}));
		} catch (error) {
			this.logger.error('Error in DatadogIntegrationConnector.getUrls:', error);
			return [];
		}
	}

	async deleteData(_: Integration, _2: AlertBL): Promise<void> {}
}
