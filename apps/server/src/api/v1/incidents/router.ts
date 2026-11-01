import { Router } from 'express';
import { IncidentController } from './controller';

export default function createIncidentRouter(incidentController: IncidentController) {
	const router = Router();

	router.get('/', incidentController.listHandler);
	router.post('/', incidentController.createHandler);
	router.get('/:incidentId', incidentController.getHandler);
	router.patch('/:incidentId', incidentController.updateHandler);
	router.post('/:incidentId/alerts', incidentController.addAlertsHandler);
	// DELETE with a body is unreliable across proxies; removal ships alert ids in the
	// body, so it rides POST on a /remove sub-path instead.
	router.post('/:incidentId/alerts/remove', incidentController.removeAlertsHandler);
	router.delete('/:incidentId', incidentController.deleteHandler);

	return router;
}
