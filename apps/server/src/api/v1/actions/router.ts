import { Router } from 'express';
import { ActionController } from './controller';

export default function createActionRouter(actionController: ActionController) {
	const router = Router();

	router.get('/', actionController.listHandler);
	router.post('/', actionController.createHandler);
	router.post('/test', actionController.testHandler);
	router.post('/:actionId/preview', actionController.previewHandler);
	router.post('/:actionId/run', actionController.runHandler);
	router.get('/:actionId', actionController.getHandler);
	router.put('/:actionId', actionController.updateHandler);
	router.delete('/:actionId', actionController.deleteHandler);

	return router;
}
