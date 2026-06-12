/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { EnrichmentController } from './controller';

export default function createEnrichmentRouter(enrichmentController: EnrichmentController) {
	const router = PromiseRouter();

	router.get('/', enrichmentController.listHandler);
	router.post('/', enrichmentController.createHandler);
	router.get('/:enrichmentId', enrichmentController.getHandler);
	router.put('/:enrichmentId', enrichmentController.updateHandler);
	router.delete('/:enrichmentId', enrichmentController.deleteHandler);

	return router;
}
