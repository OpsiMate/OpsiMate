import { Router } from 'express';
import { RetentionController } from './controller';

export default function createRetentionRouter(controller: RetentionController) {
	const router = Router();

	router.get('/', controller.getSettings);
	router.put('/config', controller.updateConfig);
	router.post('/run', controller.runNow);
	router.put('/policies/:resourceType', controller.updatePolicy);

	return router;
}
