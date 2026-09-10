import { Router } from 'express';
import { AiController } from './controller';

export default function createAiRouter(controller: AiController) {
	const router = Router();

	router.get('/status', controller.statusHandler);
	router.post('/filter', controller.filterHandler);
	router.get('/config', controller.getConfigHandler);
	router.put('/config', controller.updateConfigHandler);
	router.post('/test', controller.testConnectionHandler);

	return router;
}
