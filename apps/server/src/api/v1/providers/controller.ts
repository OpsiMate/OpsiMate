import { Request, Response } from "express";
import {AddBulkServiceSchema, CreateProviderSchema, Logger, Provider} from "@service-peek/shared";
import { z } from "zod";
import { providerConnectorFactory } from "../../../bl/providers/provider-connector/providerConnectorFactory";
import { ProviderNotFound } from "../../../bl/providers/ProviderNotFound";
import {ProviderBL} from "../../../bl/providers/provider.bl";
import { AuthenticatedRequest } from '../../../middleware/auth';

const logger: Logger = new Logger('server');

export class ProviderController {
    constructor(private providerBL: ProviderBL) {
    }

    async getProviders(req: Request, res: Response) {
        try {
            const providers = await this.providerBL.getAllProviders();
            res.json({ success: true, data: { providers } });
        } catch (error) {
            logger.error('Error getting providers:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    async createProvider(req: AuthenticatedRequest, res: Response) {
        try {
            const providerToCreate = CreateProviderSchema.parse(req.body);
            const userId = req.user?.id;
            const createdProvider = await this.providerBL.createProvider({ ...providerToCreate, createdAt: (Date.now()).toString() }, userId);
            res.status(201).json({ success: true, data: createdProvider });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else {
                logger.error('Error creating provider:', error);
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    }

    async testConnection(req: Request, res: Response) {
        try {
            const provider = CreateProviderSchema.parse(req.body) as Provider;
            const providerConnector = providerConnectorFactory(provider.providerType);
            const isValidConnection = await providerConnector.testConnection(provider);
            res.status(201).json({ success: true, data: { isValidConnection } });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else {
                logger.error('Error testing provider connection:', error);
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    }

    async updateProvider(req: AuthenticatedRequest, res: Response) {
        try {
            const providerId = parseInt(req.params.providerId);
            if (isNaN(providerId)) {
                return res.status(400).json({ success: false, error: 'Invalid provider ID' });
            }

            const validatedData = CreateProviderSchema.parse(req.body);
            const userId = req.user?.id;
            const updatedProvider = await this.providerBL.updateProvider(providerId, validatedData, userId);

            res.json({ success: true, data: updatedProvider, message: 'Provider updated successfully' });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof ProviderNotFound) {
                res.status(404).json({ success: false, error: `Provider ${error.provider} not found` });
            } else {
                logger.error('Error updating provider:', error);
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    }

    async deleteProvider(req: AuthenticatedRequest, res: Response) {
        try {
            const providerId = parseInt(req.params.providerId);
            if (isNaN(providerId)) {
                return res.status(400).json({ success: false, error: 'Invalid provider ID' });
            }
            const userId = req.user?.id;
            await this.providerBL.deleteProvider(providerId, userId);
            res.json({ success: true, message: 'Provider and associated services deleted successfully' });
        } catch (error) {
            if (error instanceof ProviderNotFound) {
                res.status(404).json({ success: false, error: `Provider ${error.provider} not found` });
            }
            logger.error('Error deleting provider:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    async bulkAddServices(req: Request, res: Response) {
        try {
            const providerId = parseInt(req.params.providerId);
            if (isNaN(providerId)) {
                return res.status(400).json({ success: false, error: 'Invalid provider ID' });
            }

            const validatedData = AddBulkServiceSchema.parse(req.body);
            const newServices = await this.providerBL.addServicesToProvider(providerId, validatedData);

            res.status(201).json({ success: true, data: newServices });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof ProviderNotFound) {
                res.status(404).json({ success: false, error: `Provider ${error.provider} not found` });
            } else {
                logger.error('Error storing services:', error);
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    }

    async discoverServices(req: Request, res: Response) {
        try {
            const providerId = parseInt(req.params.providerId);
            if (isNaN(providerId)) {
                return res.status(400).json({ success: false, error: 'Invalid provider ID' });
            }

            const discoversServices = await this.providerBL.discoverServicesInProvider(providerId);
            res.json({ success: true, data: discoversServices });
        } catch (error) {
            logger.error('Error discovering services:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}
