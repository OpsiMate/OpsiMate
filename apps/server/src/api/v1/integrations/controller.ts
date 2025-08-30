import { Request, Response } from "express";
import {
    CreateIntegrationSchema,
    Integration, IntegrationResponse,
    IntegrationTagsquerySchema, Logger
} from "@OpsiMate/shared";
import { z } from "zod";
import { IntegrationBL } from "../../../bl/integrations/integration.bl";

const logger = new Logger("v1/integrations/controller");

export function toIntegrationResponse(integration: Integration): IntegrationResponse {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { credentials, ...rest } = integration;
    return rest;
}

export class IntegrationController {
    constructor(private integrationBL: IntegrationBL) {}

    getIntegrations = async (req: Request, res: Response) => {
        try {
            const integrations = await this.integrationBL.getAllIntegrations();
            res.json({ success: true, data: { integrations: integrations.map(toIntegrationResponse) } });
        } catch (error) {
            logger.error('Error getting integrations:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    createIntegration = async (req: Request, res: Response) => {
        try {
            const integrationToCreate = CreateIntegrationSchema.parse(req.body);
            const createdIntegration: Integration = await this.integrationBL.createIntegration(integrationToCreate);
            res.status(201).json({ success: true, data: createdIntegration });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else {
                logger.error('Error creating integration:', error);
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    updateIntegration = async (req: Request, res: Response) => {
        try {
            const integrationId = parseInt(req.params.integrationId);
            if (isNaN(integrationId)) {
                return res.status(400).json({ success: false, error: 'Invalid integration ID' });
            }

            const validatedData = CreateIntegrationSchema.parse(req.body);
            const updatedIntegration = await this.integrationBL.updateIntegration(integrationId, validatedData);

            res.json({ success: true, data: toIntegrationResponse(updatedIntegration), message: 'Integration updated successfully' });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else {
                logger.error('Error updating integration:', error);
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    deleteIntegration = async (req: Request, res: Response) => {
        try {
            const integrationId = parseInt(req.params.integrationId);
            if (isNaN(integrationId)) {
                return res.status(400).json({ success: false, error: 'Invalid integration ID' });
            }

            await this.integrationBL.deleteIntegration(integrationId);
            res.json({ success: true, message: 'Integration and associated services deleted successfully' });
        } catch (error) {
            logger.error('Error deleting integration:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    getIntegrationUrls = async (req: Request, res: Response): Promise<void> => {
        try {
            const integrationId = parseInt(req.params.integrationId);
            const parsed = IntegrationTagsquerySchema.parse(req.query);
            const tags: string[] = Array.isArray(parsed.tags) ? parsed.tags : [parsed.tags];
            const response = await this.integrationBL.getIntegrationUrls(integrationId, tags)
            res.json({ success: true, data: response });

        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    details: error.errors
                });
            } else {
                logger.error('Error in refreshServicesByTags:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error'
                });
            }
        }
    }
}
