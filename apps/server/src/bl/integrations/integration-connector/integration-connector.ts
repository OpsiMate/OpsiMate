import { Integration, IntegrationUrls } from '@OpsiMate/shared';

export interface IntegrationConnector {
	getUrls(integration: Integration, tags: string[]): Promise<IntegrationUrls[]>;
}
