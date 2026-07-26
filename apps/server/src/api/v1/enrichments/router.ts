import { Router } from 'express';
import { EnrichmentController } from './controller';

export default function createEnrichmentRouter(enrichmentController: EnrichmentController) {
	const router = Router();

	router.get('/', enrichmentController.listHandler);
	router.post('/', enrichmentController.createHandler);
	router.get('/:enrichmentId', enrichmentController.getHandler);
	router.put('/:enrichmentId', enrichmentController.updateHandler);
	router.delete('/:enrichmentId', enrichmentController.deleteHandler);

	return router;
}
