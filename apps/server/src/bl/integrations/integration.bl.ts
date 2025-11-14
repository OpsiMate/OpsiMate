import { IntegrationRepository } from '../../dal/integrationRepository';
import { Integration, IntegrationType, Logger } from '@OpsiMate/shared';
import { integrationConnectorFactory } from './integration-connector/integration-connector-factory';
import { AlertBL } from '../alerts/alert.bl.ts';

const logger = new Logger('bl/integrations/integration.bl');

export class IntegrationBL {
	constructor(
		private integrationRepo: IntegrationRepository,
		private alertsBl: AlertBL
	) {}

	async getAllIntegrations(): Promise<Integration[]> {
		try {
			logger.info('Starting to fetch all integrations...');
			const integrations = await this.integrationRepo.getAllIntegrations();
			logger.info(`Fetched ${integrations.length} integrations.`);
			return integrations;
		} catch (error) {
			logger.info('Unable to fetch integrations');
			throw error;
		}
	}

	async createIntegration(integrationToCreate: Omit<Integration, 'id' | 'createdAt'>): Promise<Integration> {
		try {
			logger.info(`Starting to create integration: ${JSON.stringify(integrationToCreate)}`);
			const { lastID } = await this.integrationRepo.createIntegration(integrationToCreate);
			logger.info(`Integration created with ID: ${lastID}`);

			const createdIntegration = await this.integrationRepo.getIntegrationById(lastID);
			logger.info(`Fetched created integration: ${JSON.stringify(createdIntegration)}`);

			return createdIntegration;
		} catch (error) {
			logger.error(`Error creating integration`, error);
			throw error;
		}
	}

	async getIntegrationByType(type: IntegrationType): Promise<Integration | undefined> {
		return await this.integrationRepo.getIntegrationByType(type);
	}

	async updateIntegration(
		integrationId: number,
		integrationToUpdate: Omit<Integration, 'id' | 'createdAt'>
	): Promise<Integration> {
		logger.info(`Starting to update integration: ${integrationId}`);
		await this.validateIntegrationExists(integrationId);

		try {
			await this.integrationRepo.updateIntegration(integrationId, integrationToUpdate);
			logger.info(`Updated integration with ID: ${integrationId}`);
			return await this.integrationRepo.getIntegrationById(integrationId);
		} catch (error) {
			logger.error(`Error updating integration`, error);
			throw error;
		}
	}

	async deleteIntegration(integrationId: number): Promise<void> {
		logger.info(`Starting to delete integration: ${integrationId}`);
		const integration = await this.validateIntegrationExists(integrationId);

		try {
			await this.integrationRepo.deleteIntegration(integrationId);
			await integrationConnectorFactory(integration.type).deleteData(integration, this.alertsBl);
		} catch (error) {
			logger.error(`Error deleting integration [${integrationId}]`, error);
			throw error;
		}
	}

	private async validateIntegrationExists(integrationId: number): Promise<Integration> {
		const integration = await this.integrationRepo.getIntegrationById(integrationId);
		if (!integration) {
			throw new Error(`Integration with ID ${integrationId} does not exist.`);
		}
		return integration;
	}

	async getIntegrationUrls(integrationId: number, tags: string[]) {
		const integration = await this.integrationRepo.getIntegrationById(integrationId);
		if (!integration) {
			throw new Error(`Integration with ID ${integrationId} does not exist.`);
		}
		return await integrationConnectorFactory(integration.type).getUrls(integration, tags);
	}
}
