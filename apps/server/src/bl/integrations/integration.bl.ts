// Temporary: replace with your project's real types when available
type Integration = { id: number; name: string; type: string; }; // Add other fields if needed
type IntegrationType = string;
class Logger {
  constructor(name: string) {}
  info(...args: any[]): void {}
  error(...args: any[]): void {}
}

import { IntegrationRepository } from "../../dal/integrationRepository.js";
import { integrationConnectorFactory } from "./integration-connector/integration-connector-factory.js";
import { AuditBL } from "../audit/audit.bl.js";
import { AuditLogRepository } from "../../dal/auditLogRepository.js";
import { initializeDb } from "../../dal/db.js";
const db = initializeDb();

const logger = new Logger('bl/integrations/integration.bl');
const auditBL = new AuditBL(new AuditLogRepository(db));

export class IntegrationBL {
  constructor(private integrationRepo: IntegrationRepository) {}

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

  // Added 'performedBy' parameter for audit logging
  async createIntegration(
    integrationToCreate: Omit<Integration, 'id' | 'createdAt'>,
    performedBy: string
  ): Promise<Integration> {
    try {
      logger.info(`Starting to create integration: ${JSON.stringify(integrationToCreate)}`);
      const { lastID } = await this.integrationRepo.createIntegration(integrationToCreate);
      logger.info(`Integration created with ID: ${lastID}`);

      const createdIntegration = await this.integrationRepo.getIntegrationById(lastID);
      logger.info(`Fetched created integration: ${JSON.stringify(createdIntegration)}`);

      // Audit log creation event
      await auditBL.logAction({
        action: "integration_created",
        performedBy: performedBy,
        details: {
          id: createdIntegration.id,
          name: createdIntegration.name,
          type: createdIntegration.type,
        }
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

  async updateIntegration(integrationId: number, integrationToUpdate: Omit<Integration, 'id' | 'createdAt'>): Promise<Integration> {
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
    await this.validateIntegrationExists(integrationId);

    try {
      await this.integrationRepo.deleteIntegration(integrationId);
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
    return await integrationConnectorFactory(integration.type).getUrls(integration, tags);
  }
}
