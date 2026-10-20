import { Router } from 'express';
import { requireAdmin } from '../../../middleware/auth';
import { CallbackController } from './controller';

// Callbacks carry receiver URLs and auth headers and fire on every alert change, so the
// whole surface — reading included — is for admins.
export default function createCallbackRouter(callbackController: CallbackController) {
	const router = Router();

	router.use(requireAdmin);
	router.get('/', callbackController.listHandler);
	router.post('/', callbackController.createHandler);
	router.post('/test', callbackController.testHandler);
	router.get('/:callbackId', callbackController.getHandler);
	router.put('/:callbackId', callbackController.updateHandler);
	router.delete('/:callbackId', callbackController.deleteHandler);

	return router;
}
