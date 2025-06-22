import express, { Request, Response } from 'express';
import { createProvider, fetchProviderInstances, bulkInsertServices, listProviders, listServicesByProvider } from '../bl/providerService';

const router = express.Router();

// POST /api/v1/integration/providers
router.post('/providers', async (req: Request, res: Response) => {
  try {
    const provider = await createProvider(req.body);
    res.status(201).json({ success: true, data: provider });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else {
      console.error('Error creating provider:', error);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  }
});

// GET /api/v1/integration/providers/:providerId/instance
router.get('/providers/:providerId/instance', async (req: Request, res: Response) => {
  try {
    const providerId = parseInt(req.params.providerId);
    if (isNaN(providerId)) {
      return res.status(400).json({ success: false, error: 'Invalid provider ID' });
    }

    const data = await fetchProviderInstances(providerId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error getting provider instances:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// POST /api/v1/integration/providers/:providerId/instance/bulk
router.post('/providers/:providerId/instance/bulk', async (req: Request, res: Response) => {
  try {
    const providerId = parseInt(req.params.providerId);
    if (isNaN(providerId)) {
      return res.status(400).json({ success: false, error: 'Invalid provider ID' });
    }
    const services = await bulkInsertServices(providerId, req.body);
    res.status(201).json({ success: true, data: services });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else if (error.message === 'Provider not found') {
      res.status(404).json({ success: false, error: 'Provider not found' });
    } else {
      console.error('Error storing services:', error);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  }
});

// GET /api/v1/integration/providers
router.get('/providers', async (_req: Request, res: Response) => {
  try {
    const providers = await listProviders();
    res.json({ success: true, data: providers });
  } catch (error: any) {
    console.error('Error getting providers:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// GET /api/v1/integration/providers/:providerId/services
router.get('/providers/:providerId/services', async (req: Request, res: Response) => {
  try {
    const providerId = parseInt(req.params.providerId);
    if (isNaN(providerId)) {
      return res.status(400).json({ success: false, error: 'Invalid provider ID' });
    }
    const services = await listServicesByProvider(providerId);
    res.json({ success: true, data: services });
  } catch (error: any) {
    console.error('Error getting services:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

export default router;