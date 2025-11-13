/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { AlertController } from './controller';

export default function createAlertRouter(controller: AlertController) {
	const router = PromiseRouter();

	// GET all alerts
	router.get('/', controller.getAlerts.bind(controller));

	// Dismiss an alert
	router.patch('/:id/dismiss', controller.dismissAlert.bind(controller));

	// Undismiss an alert
	router.patch('/:id/undismiss', controller.undismissAlert.bind(controller));

	router.post('/custom/gcp', controller.createCustomGCPAlert.bind(controller));

	return router;
}
