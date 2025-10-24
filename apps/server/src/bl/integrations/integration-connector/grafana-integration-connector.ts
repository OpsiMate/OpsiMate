import { Integration, IntegrationUrls } from '@OpsiMate/shared';
import { IntegrationConnector } from './integration-connector';
import { GrafanaClient, GrafanaDashboardSummary } from '../../../dal/external-client/grafana-client';

export class GrafanaIntegrationConnector implements IntegrationConnector {
	async getUrls(integration: Integration, tags: string[]): Promise<IntegrationUrls[]> {
		const grafanaClient = new GrafanaClient(integration.externalUrl, integration.credentials['apiKey'] as string);

		const dashboards: GrafanaDashboardSummary[] = await grafanaClient.searchByTags(tags);

		return dashboards.map((dash) => ({
			name: dash.title,
			url: `${integration.externalUrl.replace(/\/$/, '')}${dash.url}`,
		}));
	}
}
