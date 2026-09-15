import { Router } from 'express';
import { RetentionController } from './controller';
import { requireAdmin } from '../../../middleware/auth';

export default function createRetentionRouter(controller: RetentionController) {
	const router = Router();

	// Every retention endpoint is org-wide configuration: admins only.
	router.use(requireAdmin);

	router.get('/', controller.getSettings);
	router.put('/config', controller.updateConfig);
	router.post('/run', controller.runNow);
	router.put('/policies/:resourceType', controller.updatePolicy);

	return router;
}
