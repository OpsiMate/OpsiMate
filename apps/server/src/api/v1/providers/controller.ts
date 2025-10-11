import {Request, Response} from "express";
import {
    AddBulkServiceSchema,
    CreateProviderBulkSchema,
    CreateProviderSchema,
    Logger,
    Provider,
    User
} from "@OpsiMate/shared";
import {providerConnectorFactory} from "../../../bl/providers/provider-connector/providerConnectorFactory";
import {ProviderNotFound} from "../../../bl/providers/ProviderNotFound";
import {ProviderBL} from "../../../bl/providers/provider.bl";
import {AuthenticatedRequest} from '../../../middleware/auth';
import {SecretsMetadataRepository} from "../../../dal/secretsMetadataRepository";
import { isZodError } from "../../../utils/isZodError";

const logger: Logger = new Logger('server');

// Helper function to prepare error for robust logging
const prepareErrorForLog = (error: unknown) => {
    return error instanceof Error ? 
        { message: error.message, stack: error.stack } : 
        { details: error };
};

export class ProviderController {
    constructor(private providerBL: ProviderBL, private secretsRepo: SecretsMetadataRepository) {
    }

    async getProviders(req: Request, res: Response) {
        try {
            const providers = await this.providerBL.getAllProviders();
            providers.forEach(provider => {
                delete provider.password;
            })
            return res.json({success: true, data: {providers}});
        } catch (error) {
            logger.error('Error getting providers:', prepareErrorForLog(error)); // Updated logging
            return res.status(500).json({success: false, error: 'Internal server error'});
        }
    }

    async refreshProvider(req: Request, res: Response) {
        try {
            const providerId = parseInt(req.params.providerId);
            if (isNaN(providerId)) {
                return res.status(400).json({success: false, error: 'Invalid provider ID'});
            }

            const result = await this.providerBL.refreshProvider(providerId);
            
            delete result.provider.password;
            
            return res.json({
                success: true, 
                data: {
                    provider: result.provider,
                    services: result.services
                },
                message: 'Provider refreshed successfully'
            });
        } catch (error) {
            const errorObject = prepareErrorForLog(error); // Prepared for logging
            if (error instanceof ProviderNotFound) {
                return res.status(404).json({success: false, error: `Provider ${error.provider} not found`});
            } else {
                logger.error('Error refreshing provider:', errorObject); // Updated logging
                // Updated to return a generic "Internal server error" for non-404 failures (to match test expectation)
                return res.status(500).json({success: false, error: 'Internal server error'});
            }
        }
    }

    async createProvider(req: AuthenticatedRequest, res: Response) {
        try {
            const providerToCreate = CreateProviderSchema.parse(req.body);
            const createdProvider = await this.providerBL.createProvider({
                ...providerToCreate,
                createdAt: (Date.now()).toString()
            }, req.user as User);
            return res.status(201).json({success: true, data: createdProvider});
        } catch (error) {
            const errorObject = prepareErrorForLog(error); // Prepared for logging
            if (isZodError(error)) {
                return res.status(400).json({success: false, error: 'Validation error', details: error.errors});
            } else {
                logger.error('Error creating provider:', errorObject); // Updated logging
                return res.status(500).json({success: false, error: 'Internal server error'});
            }
        }
    }

    async createProviderBulk(req: AuthenticatedRequest, res: Response) {
        try { // Added try/catch block
            const providerToCreate = CreateProviderBulkSchema.parse(req.body);

            const created = Date.now().toString()

            const providesPromises = providerToCreate.providers.map(provider => {
                return this.providerBL.createProvider({
                    ...provider,
                    createdAt: created
                }, req.user as User);
            })
            await Promise.all(providesPromises)

            return res.status(201).json({success: true});
        } catch (error) {
            const errorObject = prepareErrorForLog(error); // Prepared for logging
            if (isZodError(error)) {
                return res.status(400).json({success: false, error: 'Validation error', details: error.errors});
            } else {
                logger.error('Error creating providers in bulk:', errorObject); // Updated logging
                return res.status(500).json({success: false, error: 'Internal server error'});
            }
        }
    }

    async testConnection(req: Request, res: Response) {
        try {
            const providerData = CreateProviderSchema.parse(req.body);

            // Resolve secretId to privateKeyFilename if provided
            const resolvedProvider = { ...providerData } as Provider;
            if (providerData.secretId) {
                const secret = await this.secretsRepo.getSecretById(providerData.secretId);
                if (!secret) {
                    return res.status(400).json({success: false, error: `Secret with ID ${providerData.secretId} not found`});
                }
                resolvedProvider.privateKeyFilename = secret.fileName;
                delete resolvedProvider.secretId;
            }

            const providerConnector = providerConnectorFactory(resolvedProvider.providerType);
            const testResult = await providerConnector.testConnection(resolvedProvider);

            if (testResult.success) {
                return res.status(200).json({success: true, data: {isValidConnection: true}});
            } else {
                return res.status(200).json({success: false, error: testResult.error || 'Connection test failed', data: {isValidConnection: false}});
            }
        } catch (error) {
            const errorObject = prepareErrorForLog(error); // Prepared for logging
            if (isZodError(error)) {
                return res.status(400).json({success: false, error: 'Validation error', details: error.errors});
            } else {
                logger.error('Error testing provider connection:', errorObject); // Updated logging
                const errorMessage = error instanceof Error ? error.message : 'Internal server error';
                return res.status(500).json({success: false, error: errorMessage});
            }
        }
    }

    async updateProvider(req: AuthenticatedRequest, res: Response) {
        try {
            const providerId = parseInt(req.params.providerId);
            if (isNaN(providerId)) {
                return res.status(400).json({success: false, error: 'Invalid provider ID'});
            }

            const validatedData = CreateProviderSchema.parse(req.body);
            const updatedProvider = await this.providerBL.updateProvider(providerId, validatedData, req.user as User);

            return res.json({success: true, data: updatedProvider, message: 'Provider updated successfully'});
        } catch (error) {
            const errorObject = prepareErrorForLog(error); // Prepared for logging
            if (isZodError(error)) {
                return res.status(400).json({success: false, error: 'Validation error', details: error.errors});
            } else if (error instanceof ProviderNotFound) {
                return res.status(404).json({success: false, error: `Provider ${error.provider} not found`});
            } else {
                logger.error('Error updating provider:', errorObject); // Updated logging
                return res.status(500).json({success: false, error: 'Internal server error'});
            }
        }
    }

    async deleteProvider(req: AuthenticatedRequest, res: Response) {
        try {
            const providerId = parseInt(req.params.providerId);
            if (isNaN(providerId)) {
                return res.status(400).json({success: false, error: 'Invalid provider ID'});
            }
            await this.providerBL.deleteProvider(providerId, req.user as User);
            return res.json({success: true, message: 'Provider and associated services deleted successfully'});
        } catch (error) {
            const errorObject = prepareErrorForLog(error); // Prepared for logging
            if (error instanceof ProviderNotFound) {
                return res.status(404).json({success: false, error: `Provider ${error.provider} not found`});
            }
            logger.error('Error deleting provider:', errorObject); // Updated logging
            return res.status(500).json({success: false, error: 'Internal server error'});
        }
    }

    async bulkAddServices(req: Request, res: Response) {
        try {
            const providerId = parseInt(req.params.providerId);
            if (isNaN(providerId)) {
                return res.status(400).json({success: false, error: 'Invalid provider ID'});
            }

            const validatedData = AddBulkServiceSchema.parse(req.body);
            const newServices = await this.providerBL.addServicesToProvider(providerId, validatedData);

            return res.status(201).json({success: true, data: newServices});
        } catch (error) {
            const errorObject = prepareErrorForLog(error); // Prepared for logging
            if (isZodError(error)) {
                return res.status(400).json({success: false, error: 'Validation error', details: error.errors});
            } else if (error instanceof ProviderNotFound) {
                return res.status(404).json({success: false, error: `Provider ${error.provider} not found`});
            } else {
                logger.error('Error storing services:', errorObject); // Updated logging
                return res.status(500).json({success: false, error: 'Internal server error'});
            }
        }
    }

    async discoverServices(req: Request, res: Response) {
        try {
            const providerId = parseInt(req.params.providerId);
            if (isNaN(providerId)) {
                return res.status(400).json({success: false, error: 'Invalid provider ID'});
            }

            const discoversServices = await this.providerBL.discoverServicesInProvider(providerId);
            return res.json({success: true, data: discoversServices});
        } catch (error) {
            const errorObject = prepareErrorForLog(error); // Prepared for logging
            // Explicitly handle ProviderNotFound as 404 for better API consistency
            if (error instanceof ProviderNotFound) {
                return res.status(404).json({success: false, error: `Provider ${error.provider} not found`});
            }
            logger.error('Error discovering services:', errorObject); // Updated logging
            return res.status(500).json({success: false, error: 'Internal server error'});
        }
    }
}
