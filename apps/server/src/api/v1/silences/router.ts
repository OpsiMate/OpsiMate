/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { SilenceController } from './controller';

export default function createSilenceRouter(silenceController: SilenceController) {
	const router = PromiseRouter();

	router.get('/', silenceController.listHandler);
	router.post('/', silenceController.createHandler);
	router.get('/:silenceId', silenceController.getHandler);
	router.put('/:silenceId', silenceController.updateHandler);
	router.delete('/:silenceId', silenceController.deleteHandler);

	return router;
}
