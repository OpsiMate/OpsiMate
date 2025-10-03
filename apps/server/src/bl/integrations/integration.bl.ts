import { IntegrationRepository } from "../../dal/integrationRepository";
import {Integration, IntegrationType, Logger, User} from "@OpsiMate/shared";
import { AuditActionType, AuditResourceType } from '@OpsiMate/shared';
import {integrationConnectorFactory} from "./integration-connector/integration-connector-factory";
import { AuditBL } from '../audit/audit.bl';

const logger = new Logger('bl/integrations/integration.bl');

export class IntegrationBL {
    constructor(
        private integrationRepo: IntegrationRepository,
        private auditBL: AuditBL
    ) {}

    async getAllIntegrations(): Promise<Integration[]> {
        try {
            logger.info("Starting to fetch all integrations...");
            const integrations = await this.integrationRepo.getAllIntegrations();
            logger.info(`Fetched ${integrations.length} integrations.`);
            return integrations;
        } catch (error) {
            logger.info("Unable to fetch integrations");
            throw error;
        }
    }

    async createIntegration(integrationToCreate: Omit<Integration, 'id' | 'createdAt'>, user: User): Promise<Integration> {
        try {
            logger.info(`Starting to create integration: ${JSON.stringify(integrationToCreate)}`);
            const { lastID } = await this.integrationRepo.createIntegration(integrationToCreate);
            logger.info(`Integration created with ID: ${lastID}`);

            const createdIntegration = await this.integrationRepo.getIntegrationById(lastID);
            logger.info(`Fetched created integration: ${JSON.stringify(createdIntegration)}`);

            // Log audit event for integration creation
            await this.auditBL.logAction({
                actionType: AuditActionType.CREATE,
                resourceType: AuditResourceType.INTEGRATION,
                resourceId: String(lastID),
                userId: user.id,
                userName: user.fullName,
                resourceName: integrationToCreate.name,
                details: `Integration type: ${integrationToCreate.type}, External URL: ${integrationToCreate.externalUrl}`
            });

            return createdIntegration;
        } catch (error) {
            logger.error(`Error creating integration`, error);
            throw error;
        }
    }

    async getIntegrationByType(type: IntegrationType): Promise<Integration | undefined> {
        return await this.integrationRepo.getIntegrationByType(type);
    }

    async updateIntegration(integrationId: number, integrationToUpdate: Omit<Integration, 'id' | 'createdAt'>, user: User): Promise<Integration> {
        logger.info(`Starting to update integration: ${integrationId}`);
        await this.validateIntegrationExists(integrationId);

        try {
            await this.integrationRepo.updateIntegration(integrationId, integrationToUpdate);
            logger.info(`Updated integration with ID: ${integrationId}`);
            
            const updatedIntegration = await this.integrationRepo.getIntegrationById(integrationId);

            // Log audit event for integration update
            await this.auditBL.logAction({
                actionType: AuditActionType.UPDATE,
                resourceType: AuditResourceType.INTEGRATION,
                resourceId: String(integrationId),
                userId: user.id,
                userName: user.fullName,
                resourceName: integrationToUpdate.name,
                details: `Integration type: ${integrationToUpdate.type}, External URL: ${integrationToUpdate.externalUrl}`
            });

            return updatedIntegration;
        } catch (error) {
            logger.error(`Error updating integration`, error);
            throw error;
        }
    }

    async deleteIntegration(integrationId: number, user: User): Promise<void> {
        logger.info(`Starting to delete integration: ${integrationId}`);
        await this.validateIntegrationExists(integrationId);

        // Get integration details before deletion for audit logging
        const integrationToDelete = await this.integrationRepo.getIntegrationById(integrationId);

        try {
            await this.integrationRepo.deleteIntegration(integrationId);

            // Log audit event for integration deletion
            await this.auditBL.logAction({
                actionType: AuditActionType.DELETE,
                resourceType: AuditResourceType.INTEGRATION,
                resourceId: String(integrationId),
                userId: user.id,
                userName: user.fullName,
                resourceName: integrationToDelete.name,
                details: `Integration type: ${integrationToDelete.type}, External URL: ${integrationToDelete.externalUrl}`
            });
        } catch (error) {
            logger.error(`Error deleting integration [${integrationId}]`, error);
            throw error;
        }
    }

    private async validateIntegrationExists(integrationId: number): Promise<void> {
        const integration = await this.integrationRepo.getIntegrationById(integrationId);
        if (!integration) {
            throw new Error(`Integration with ID ${integrationId} does not exist.`);
        }
    }

    async getIntegrationUrls(integrationId: number, tags: string[]) {
        const integration = await this.integrationRepo.getIntegrationById(integrationId);
        if (!integration) {
            throw new Error(`Integration with ID ${integrationId} does not exist.`);
        }
        return await integrationConnectorFactory(integration.type).getUrls(integration, tags)
    }
}
