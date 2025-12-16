/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { DashboardController } from './controller';

export default function createDashboardRouter(controller: DashboardController) {
	const router = PromiseRouter();

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
