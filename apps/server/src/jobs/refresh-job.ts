/* eslint-disable @typescript-eslint/no-misused-promises */
import { ProviderBL } from '../bl/providers/provider.bl';
import { providerConnectorFactory } from '../bl/providers/provider-connector/providerConnectorFactory';
import { DiscoveredService, Logger, Provider, ServiceType } from '@OpsiMate/shared';
import { ServiceRepository } from "../dal/serviceRepository";
import { checkSystemServiceStatus } from "../dal/sshClient";

const BATCH_SIZE = 10;
const logger = new Logger('refresh-job');

export class RefreshJob {
    constructor(
        private providerBL: ProviderBL,
        private serviceRepo: ServiceRepository
    ) {}

    startRefreshJob = () => {
        logger.info('[Job] Starting refreshAllProvidersServices job (every 10 minutes)');

        // Run immediately on startup (optional)
        this.refreshAllProvidersServices().catch((err) =>
            logger.error('[Job] Initial run failed:', err)
        );

        // Then run every 10 minutes
        setInterval(async () => {
            logger.info('[Job] Running refreshAllProvidersServices');
            try {
                await this.refreshAllProvidersServices();
            } catch (err) {
                logger.error('[Job] Failed to refresh services:', err);
            }
        }, 10 * 1000);
    };

    private refreshAllProvidersServices = async () => {
        const providers = await this.providerBL.getAllProviders();
        const batches = this.chunkArray(providers, BATCH_SIZE);

        for (const batch of batches) {
            await Promise.all(batch.map(this.refreshProviderServicesSafely));
        }
    };

    private refreshProviderServicesSafely = async (provider: Provider): Promise<void> => {
        try {
            await this.refreshProviderServices(provider);
        } catch (err) {
            logger.error(`Failed to refresh services for provider ${provider.id}:`, err);
        }
    };

    private refreshProviderServices = async (provider: Provider): Promise<void> => {
        const connector = providerConnectorFactory(provider.providerType);
        const discoveredServices: DiscoveredService[] = await connector.discoverServices(provider);
        const dbServices = await this.serviceRepo.getServicesByProviderId(provider.id);

        for (const dbService of dbServices) {
            // For systemd services, we need to check them individually to ensure accurate status
            if (dbService.serviceType === ServiceType.SYSTEMD) {
                try {
                    const actualStatus = await checkSystemServiceStatus(provider, dbService.name);
                    
                    // Update service status only if it is different to reduce db calls
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
                // For non-systemd services, use the discovered services
                const matchedService = this.findMatchingService(discoveredServices, dbService.name);

                if (!matchedService) {
                    await this.serviceRepo.deleteService(dbService.id);
                }

                // Update service status only if it is different to reduce db calls
                if (matchedService && matchedService.serviceStatus !== dbService.serviceStatus) {
                    await this.serviceRepo.updateService(dbService.id, {
                        serviceStatus: matchedService.serviceStatus
                    });
                }
            }
        }
    };

    private findMatchingService = (
        discoveredServices: DiscoveredService[],
        dbServiceName: string
    ): DiscoveredService | undefined => {
        return discoveredServices.find(
            ds => ds.name.trim().toLowerCase() === dbServiceName.trim().toLowerCase()
        );
    };

    private chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    };
}
