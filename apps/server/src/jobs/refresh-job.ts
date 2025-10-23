/* eslint-disable @typescript-eslint/no-misused-promises */
import { ProviderBL } from '../bl/providers/provider.bl';
import { Logger, Provider } from '@OpsiMate/shared';

const BATCH_SIZE = 10;
const logger = new Logger('refresh-job');

export class RefreshJob {
    constructor(
        private providerBL: ProviderBL
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
            await this.providerBL.refreshProviderServices(provider);
        } catch (err) {
            logger.error(`Failed to refresh services for provider ${provider.id}:`, err);
        }
    };

    private chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    };
}
