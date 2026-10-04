import { Router } from 'express';
import { LdapController } from './controller';
import { requireAdmin } from '../../../middleware/auth';

export default function createLdapRouter(controller: LdapController) {
	const router = Router();

	router.get('/settings', requireAdmin, controller.getSettingsHandler);
	router.put('/settings', requireAdmin, controller.updateSettingsHandler);
	router.post('/test', requireAdmin, controller.testHandler);

	return router;
}
