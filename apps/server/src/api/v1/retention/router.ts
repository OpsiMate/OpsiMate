/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { RetentionController } from './controller';

export default function createRetentionRouter(controller: RetentionController) {
	const router = PromiseRouter();

	router.get('/', controller.getSettings);
	router.put('/config', controller.updateConfig);
	router.post('/run', controller.runNow);
	router.put('/policies/:resourceType', controller.updatePolicy);

	return router;
}
