/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { AlertController } from './controller';

export default function createAlertRouter(controller: AlertController) {
	const router = PromiseRouter();

	// CRUD
	router.get('/', controller.getAlerts.bind(controller));

	// Archived alerts (must be before /:alertId to avoid route conflicts)
	router.get('/archived', controller.getArchivedAlerts.bind(controller));
	router.delete('/archived/:alertId', controller.deleteArchivedAlert.bind(controller));

	// Delete alert (parameterized route must come after specific routes)
	router.delete('/:alertId', controller.deleteAlert.bind(controller));

	// Dismiss Unsimiss an alert
	router.patch('/:id/dismiss', controller.dismissAlert.bind(controller));
	router.patch('/:id/undismiss', controller.undismissAlert.bind(controller));

	// Create custom alerts
	router.post('/custom/gcp', controller.createCustomGCPAlert.bind(controller));
	router.post('/custom', controller.createCustomAlert.bind(controller));

	return router;
}
