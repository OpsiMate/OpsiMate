import { Request, Response } from 'express';
import { ApiKeyBL } from '../../../bl/apiKeys/apiKey.bl.js';
import { CreateApiKeySchema, ApiKeyIdSchema, UpdateApiKeySchema } from '@OpsiMate/shared';
import { AuthenticatedRequest } from '../../../middleware/auth.js';
import { isZodError } from '../../../utils/isZodError.js';

export class ApiKeyController {
    constructor(private apiKeyBL: ApiKeyBL) {}

    createApiKeyHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        try {
            const request = CreateApiKeySchema.parse(req.body);
            const apiKey = await this.apiKeyBL.createApiKey(req.user.id, request);
            return res.status(201).json({ success: true, data: apiKey });
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof Error) {
                return res.status(400).json({ success: false, error: error.message });
            } else {
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    getApiKeysHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        try {
            const apiKeys = await this.apiKeyBL.getApiKeysByUserId(req.user.id);
            return res.status(200).json({ success: true, data: apiKeys });
        } catch {
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    getApiKeyHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        try {
            const { apiKeyId } = ApiKeyIdSchema.parse(req.params);
            const apiKey = await this.apiKeyBL.getApiKeyById(apiKeyId, req.user.id);
            
            if (!apiKey) {
                return res.status(404).json({ success: false, error: 'API key not found' });
            }

            return res.status(200).json({ success: true, data: apiKey });
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else {
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    updateApiKeyHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        try {
            const { apiKeyId } = ApiKeyIdSchema.parse(req.params);
            const updates = UpdateApiKeySchema.parse(req.body);
            
            const apiKey = await this.apiKeyBL.updateApiKey(apiKeyId, req.user.id, updates);
            return res.status(200).json({ success: true, data: apiKey });
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof Error) {
                return res.status(400).json({ success: false, error: error.message });
            } else {
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };

    deleteApiKeyHandler = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        try {
            const { apiKeyId } = ApiKeyIdSchema.parse(req.params);
            await this.apiKeyBL.deleteApiKey(apiKeyId, req.user.id);
            return res.status(204).send();
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
            } else if (error instanceof Error) {
                return res.status(400).json({ success: false, error: error.message });
            } else {
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
        }
    };
}
