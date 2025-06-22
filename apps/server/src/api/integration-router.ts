import express from 'express';
import { z } from 'zod';
import { ProviderService } from '../bl/provider-service';
import { ServiceService } from '../bl/service-service';

const router = express.Router();

// POST /api/v1/integration/providers
router.post('/providers', async (req: express.Request, res: express.Response) => {
    try {
        const provider = await ProviderService.createProvider(req.body);
        
        res.status(201).json({
            success: true,
            data: provider
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.errors
            });
        } else {
            console.error('Error creating provider:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
});

// GET /api/v1/integration/providers/:providerId/instance
router.get('/providers/:providerId/instance', async (req: express.Request, res: express.Response) => {
    try {
        const providerId = parseInt(req.params.providerId);
        const result = await ProviderService.getProviderWithContainers(providerId);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error getting provider instances:', error);
        
        if (error instanceof Error) {
            if (error.message === 'Invalid provider ID') {
                res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message === 'Provider not found') {
                res.status(404).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('Private key file') || error.message.includes('Docker')) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to connect to provider via SSH',
                    details: error.message
                });
            }
        } else {
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
});

// POST /api/v1/integration/providers/:providerId/instance/bulk
router.post('/providers/:providerId/instance/bulk', async (req: express.Request, res: express.Response) => {
    try {
        const providerId = parseInt(req.params.providerId);
        const storedServices = await ServiceService.bulkCreateServices(providerId, req.body);
        
        res.status(201).json({
            success: true,
            data: storedServices
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.errors
            });
        } else if (error instanceof Error) {
            if (error.message === 'Invalid provider ID') {
                res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message === 'Provider not found') {
                res.status(404).json({
                    success: false,
                    error: error.message
                });
            } else {
                console.error('Error storing services:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error'
                });
            }
        } else {
            console.error('Error storing services:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
});

// GET /api/v1/integration/providers
router.get('/providers', async (req: express.Request, res: express.Response) => {
    try {
        const providers = await ProviderService.getAllProviders();
        
        res.json({
            success: true,
            data: providers
        });
    } catch (error) {
        console.error('Error getting providers:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/v1/integration/providers/:providerId/services
router.get('/providers/:providerId/services', async (req: express.Request, res: express.Response) => {
    try {
        const providerId = parseInt(req.params.providerId);
        const services = await ServiceService.getServicesByProviderId(providerId);
        
        res.json({
            success: true,
            data: services
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'Invalid provider ID') {
            res.status(400).json({
                success: false,
                error: error.message
            });
        } else {
            console.error('Error getting services:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
});

export default router;