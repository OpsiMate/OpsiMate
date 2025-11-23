import { Integration, IntegrationUrls } from '@OpsiMate/shared';
import { AlertBL } from '../../alerts/alert.bl';

export interface IntegrationConnector {
	getUrls(integration: Integration, tags: string[]): Promise<IntegrationUrls[]>;
	deleteData(integration: Integration, alertBL: AlertBL): Promise<void>;
	testConnection(integration: Integration): Promise<{ success: boolean; error?: string }>;
}
