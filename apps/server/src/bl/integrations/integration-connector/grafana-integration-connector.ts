import { Integration, IntegrationUrls } from '@OpsiMate/shared';
import { IntegrationConnector } from './integration-connector';
import { GrafanaClient, GrafanaDashboardSummary } from '../../../dal/external-client/grafana-client';
import { AlertBL } from '../../alerts/alert.bl';

export class GrafanaIntegrationConnector implements IntegrationConnector {
	async getUrls(integration: Integration, tags: string[]): Promise<IntegrationUrls[]> {
		const grafanaClient = new GrafanaClient(integration.externalUrl, integration.credentials['apiKey'] as string);

		const dashboards: GrafanaDashboardSummary[] = await grafanaClient.searchByTags(tags);

		return dashboards.map((dash) => ({
			name: dash.title,
			url: `${integration.externalUrl.replace(/\/$/, '')}${dash.url}`,
		}));
	}

	async deleteData(_: Integration, alertBL: AlertBL): Promise<void> {
		await alertBL.archiveNonActiveAlerts(new Set(), 'Grafana');
	}

	async testConnection(integration: Integration): Promise<{ success: boolean; error?: string }> {
		try {
			const grafanaClient = new GrafanaClient(
				integration.externalUrl,
				integration.credentials['apiKey'] as string
			);

			// Quick lightweight test (health endpoint)
			const health = await grafanaClient.getHealth();

			// Some Grafana versions return { commit, version, database }
			if (!health || typeof health !== 'object') {
				return { success: false, error: 'Unexpected response from Grafana health check.' };
			}

			return { success: true };
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : 'An unknown error occurred while testing the connection.';
			return {
				success: false,
				error: errorMessage,
			};
		}
	}
}
