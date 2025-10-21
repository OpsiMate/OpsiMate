import {DiscoveredService, Provider, Service, Logger, User, ServiceType} from "@OpsiMate/shared";
import { ProviderNotFound } from "./ProviderNotFound";
import { providerConnectorFactory } from "./provider-connector/providerConnectorFactory";
import {ProviderRepository} from "../../dal/providerRepository";
import {ServiceRepository} from "../../dal/serviceRepository";
import {SecretsMetadataRepository} from "../../dal/secretsMetadataRepository";
import { AuditBL } from '../audit/audit.bl';
import { AuditActionType, AuditResourceType } from '@OpsiMate/shared';
import { checkSystemServiceStatus } from "../../dal/sshClient";

const logger = new Logger('bl/providers/provider.bl');

export class ProviderBL {
    constructor(
        private providerRepo: ProviderRepository,
        private serviceRepo: ServiceRepository,
        private secretsMetadataRepo: SecretsMetadataRepository,
        private auditBL: AuditBL
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

    async createProvider(providerToCreate: Omit<Provider, 'id'>, user: User): Promise<Provider> {
        try {
            logger.info(`Starting to create provider`, { extraArgs: { ...providerToCreate } });
            
            // Resolve secretId to privateKeyFilename if provided
            const resolvedProvider = { ...providerToCreate };
            if (providerToCreate.secretId) {
                const secret = await this.secretsMetadataRepo.getSecretById(providerToCreate.secretId);
                if (!secret) {
                    throw new Error(`Secret with ID ${providerToCreate.secretId} not found`);
                }
                resolvedProvider.privateKeyFilename = secret.fileName;
                delete resolvedProvider.secretId;
            }
            
            const { lastID } = await this.providerRepo.createProvider(resolvedProvider);
            logger.info(`Provider created with ID: ${lastID}`);

            const createdProvider = await this.providerRepo.getProviderById(lastID);
            logger.info(`Fetched created provider`, { extraArgs: { ...createdProvider } });

            await this.auditBL.logAction({
                actionType: AuditActionType.CREATE,
                resourceType: AuditResourceType.PROVIDER,
                resourceId: String(lastID),
                userId: user.id,
                userName: user.fullName,
                resourceName: providerToCreate.name
            });

            return createdProvider;
        } catch (error) {
            logger.error(`Error creating provider`, error);
            throw error;
        }
    }

    async updateProvider(providerId: number, providerToUpdate: Omit<Provider, 'id' | 'createdAt'>, user: User): Promise<Provider> {
        logger.info(`Starting to update provider: ${providerId}`);
        await this.validateProviderExists(providerId);

        try {
            // Resolve secretId to privateKeyFilename if provided
            const resolvedProvider = { ...providerToUpdate };
            if (providerToUpdate.secretId) {
                const secret = await this.secretsMetadataRepo.getSecretById(providerToUpdate.secretId);
                if (!secret) {
                    throw new Error(`Secret with ID ${providerToUpdate.secretId} not found`);
                }
                resolvedProvider.privateKeyFilename = secret.fileName;
                delete resolvedProvider.secretId;
            }
            
            await this.providerRepo.updateProvider(providerId, resolvedProvider);
            logger.info(`Updated provider with ID: ${providerId}`);
            await this.auditBL.logAction({
                actionType: AuditActionType.UPDATE,
                resourceType: AuditResourceType.PROVIDER,
                resourceId: String(providerId),
                userId: user.id,
                userName: user.fullName,
                resourceName: providerToUpdate.name || '',
                details: JSON.stringify(providerToUpdate)
            });
            return await this.providerRepo.getProviderById(providerId);
        } catch (error) {
            logger.error(`Error updating provider`, error);
            throw error;
        }
    }

    async deleteProvider(providerId: number, user: User): Promise<void> {
        logger.info(`Starting to delete provider: ${providerId}`);
        const provider = await this.getProviderById(providerId);
        if (!provider) {
            throw new ProviderNotFound(providerId);
        }

        try {
            await this.providerRepo.deleteProvider(providerId);
            await this.auditBL.logAction({
                actionType: AuditActionType.DELETE,
                resourceType: AuditResourceType.PROVIDER,
                resourceId: String(providerId),
                userId: user.id,
                userName: user.fullName,
                resourceName: provider.name,
                details: undefined
            });
        } catch (error) {
            logger.error(`Error deleting provider [${providerId}]`, error);
            throw error;
        }
    }

    async discoverServicesInProvider(providerId: number): Promise<DiscoveredService[]> {
        try {
            const provider = await this.providerRepo.getProviderById(providerId);
            logger.info("Fetched provider", { extraArgs: { ...provider } });

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

    async getProviderById(providerId: number): Promise<Provider> {
        return await this.providerRepo.getProviderById(providerId);
    }

    async refreshProvider(providerId: number): Promise<{ provider: Provider; services: Service[] }> {
        logger.info(`Starting to refresh provider: ${providerId}`);
        
        const provider = await this.getProviderById(providerId);
        if (!provider) {
            throw new ProviderNotFound(providerId);
        }

        try {
            await this.refreshProviderServices(provider);
            const updatedServices = await this.serviceRepo.getServicesByProviderId(providerId);
            
            return {
                provider,
                services: updatedServices
            };
        } catch (error) {
            logger.error(`Error refreshing provider ${providerId}:`, error);
            throw new Error(`Failed to refresh provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async refreshProviderServices(provider: Provider): Promise<void> {
        const connector = providerConnectorFactory(provider.providerType);
        const discoveredServices: DiscoveredService[] = await connector.discoverServices(provider);
        const dbServices = await this.serviceRepo.getServicesByProviderId(provider.id);

        for (const dbService of dbServices) {
            if (dbService.serviceType === ServiceType.SYSTEMD) {
                try {
                    const actualStatus = await checkSystemServiceStatus(provider, dbService.name);
                    
                    if (actualStatus !== dbService.serviceStatus) {
                        await this.serviceRepo.updateService(dbService.id, {
                            serviceStatus: actualStatus
                        });
                        logger.info(`Updated systemd service ${dbService.name} status to ${actualStatus}`);
                    }
                } catch (error) {
                    logger.error(`Failed to check systemd service ${dbService.name} status:`, error);
                }
            } else {
                const matchedService = this.findMatchingService(discoveredServices, dbService.name);

                if (!matchedService) {
                    await this.serviceRepo.deleteService(dbService.id);
                }

                if (matchedService && matchedService.serviceStatus !== dbService.serviceStatus) {
                    await this.serviceRepo.updateService(dbService.id, {
                        serviceStatus: matchedService.serviceStatus
                    });
                }
            }
        }
    }

    private findMatchingService(
        discoveredServices: DiscoveredService[],
        dbServiceName: string
    ): DiscoveredService | undefined {
        return discoveredServices.find(
            ds => ds.name.trim().toLowerCase() === dbServiceName.trim().toLowerCase()
        );
    }
}
