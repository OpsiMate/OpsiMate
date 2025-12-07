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

	return router;
}
