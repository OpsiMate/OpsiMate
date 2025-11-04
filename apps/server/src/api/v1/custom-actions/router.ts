/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { CustomActionsController } from './controller';

export default function createCustomActionsRouter(controller: CustomActionsController) {
	const router = PromiseRouter();

	// CRUD
	router.get('/', controller.list);
	router.post('/', controller.create);
	router.get('/:actionId', controller.getById);
	router.put('/:actionId', controller.update);
	router.delete('/:actionId', controller.delete);

	// Run
	router.post('/run/provider/:providerId/:actionId', controller.runForProvider);
	router.post('/run/service/:serviceId/:actionId', controller.runForService);

	return router;
}
