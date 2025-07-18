import { DiscoveredService, Provider, Service, Logger } from "@service-peek/shared";
import { ProviderNotFound } from "./ProviderNotFound";
import { providerConnectorFactory } from "./provider-connector/providerConnectorFactory";
import {ProviderRepository} from "../../dal/providerRepository";
import {ServiceRepository} from "../../dal/serviceRepository";
import { AuditBL } from '../audit.bl';
import { AuditActionType, AuditResourceType } from '@service-peek/shared';

const logger = new Logger('bl/providers/provider.bl');

export class ProviderBL {
    constructor(
        private providerRepo: ProviderRepository,
        private serviceRepo: ServiceRepository,
        private auditBL?: AuditBL // optional for backward compatibility
    ) {}

    async getAllProviders(): Promise<Provider[]> {
        try {
            logger.info("Starting to fetch all providers...");
            const providers = await this.providerRepo.getAllProviders();
            logger.info(`Fetched ${providers.length} providers.`);
            return providers;
        } catch (error) {
            logger.info("Unable to fetch providers");
            throw error;
        }
    }

    async createProvider(providerToCreate: Omit<Provider, 'id'>, userId?: number): Promise<Provider> {
        try {
            logger.info(`Starting to create provider: ${JSON.stringify(providerToCreate)}`);
            const { lastID } = await this.providerRepo.createProvider(providerToCreate);
            logger.info(`Provider created with ID: ${lastID}`);

            const createdProvider = await this.providerRepo.getProviderById(lastID);
            logger.info(`Fetched created provider: ${JSON.stringify(createdProvider)}`);

            if (this.auditBL && userId) {
                await this.auditBL.logAction({
                    actionType: AuditActionType.CREATE,
                    resourceType: AuditResourceType.PROVIDER,
                    resourceId: String(lastID),
                    userId: userId,
                    details: JSON.stringify(providerToCreate)
                });
            }

            return createdProvider;
        } catch (error) {
            logger.error(`Error creating provider`, error);
            throw error;
        }
    }

    async updateProvider(providerId: number, providerToUpdate: Omit<Provider, 'id' | 'createdAt'>, userId?: number): Promise<Provider> {
        logger.info(`Starting to update provider: ${providerId}`);
        await this.validateProviderExists(providerId);

        try {
            await this.providerRepo.updateProvider(providerId, providerToUpdate);
            logger.info(`Updated provider with ID: ${providerId}`);
            if (this.auditBL && userId) {
                await this.auditBL.logAction({
                    actionType: AuditActionType.UPDATE,
                    resourceType: AuditResourceType.PROVIDER,
                    resourceId: String(providerId),
                    userId: userId,
                    details: JSON.stringify(providerToUpdate)
                });
            }
            return await this.providerRepo.getProviderById(providerId);
        } catch (error) {
            logger.error(`Error updating provider`, error);
            throw error;
        }
    }

    async deleteProvider(providerId: number, userId?: number): Promise<void> {
        logger.info(`Starting to delete provider: ${providerId}`);
        await this.validateProviderExists(providerId);

        try {
            await this.providerRepo.deleteProvider(providerId);
            if (this.auditBL && userId) {
                await this.auditBL.logAction({
                    actionType: AuditActionType.DELETE,
                    resourceType: AuditResourceType.PROVIDER,
                    resourceId: String(providerId),
                    userId: userId
                });
            }
        } catch (error) {
            logger.error(`Error deleting provider [${providerId}]`, error);
            throw error;
        }
    }

    async discoverServicesInProvider(providerId: number): Promise<DiscoveredService[]> {
        try {
            const provider = await this.providerRepo.getProviderById(providerId);
            logger.info(`Fetched provider: ${JSON.stringify(provider)}`);

            const providerConnector = providerConnectorFactory(provider.providerType);
            return await providerConnector.discoverServices(provider);
        } catch (error) {
            logger.error(`Error discovering services in provider`, error);
            throw new Error(`Failed to discover services for provider ${providerId}`);
        }
    }

    async addServicesToProvider(
        providerId: number,
        services: Omit<Service, 'id' | 'providerId' | 'createdAt'>[]
    ): Promise<Service[]> {
        logger.info(`Starting to add services [${services.length}] to provider: ${providerId}`);
        await this.validateProviderExists(providerId);
        return await this.serviceRepo.bulkCreateServices(providerId, services);
    }

    private async validateProviderExists(providerId: number): Promise<void> {
        try {
            logger.info(`Validating Provider Exists: ${providerId}`);
            await this.providerRepo.getProviderById(providerId);
        } catch (error) {
            logger.error(`Error fetching provider for validation`, error);
            throw new ProviderNotFound(providerId);
        }
    }
}
