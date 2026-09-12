import { Router } from 'express';
import { AiController } from './controller';
import { requireAdmin } from '../../../middleware/auth';

export default function createAiRouter(controller: AiController) {
	const router = Router();

	router.get('/status', controller.statusHandler);
	router.post('/filter', controller.filterHandler);
	router.get('/config', requireAdmin, controller.getConfigHandler);
	router.put('/config', requireAdmin, controller.updateConfigHandler);
	router.post('/test', requireAdmin, controller.testConnectionHandler);

	return router;
}
