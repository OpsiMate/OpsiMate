import { Router } from 'express';
import { DashboardController } from './controller';

export default function createDashboardRouter(controller: DashboardController) {
	const router = Router();

	// CRUD API
	router.get('/', controller.getDashboardsHandler);
	router.post('/', controller.createDashboardHandler);
	router.put('/:dashboardId', controller.updateDashboardHandler);
	router.delete('/:dashboardId', controller.deleteDashboardHandler);

	// Dashboard Tags API
	router.get('/tags', controller.getAllDashboardTagsHandler);
	router.get('/:dashboardId/tags', controller.getDashboardTagsHandler);
	router.post('/:dashboardId/tags', controller.addTagToDashboardHandler);
	router.delete('/:dashboardId/tags/:tagId', controller.removeTagFromDashboardHandler);

	return router;
}
