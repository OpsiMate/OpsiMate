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
	router.patch('/archived/:id/owner', controller.setArchivedAlertOwner.bind(controller));

	// Delete alert (parameterized route must come after specific routes)
	router.delete('/:alertId', controller.deleteAlert.bind(controller));

	// Dismiss Unsimiss an alert
	router.patch('/:id/dismiss', controller.dismissAlert.bind(controller));
	router.patch('/:id/undismiss', controller.undismissAlert.bind(controller));

	// Set alert owner
	router.patch('/:id/owner', controller.setAlertOwner.bind(controller));

	// Alert Comments
	router.get('/:alertId/comments', controller.getCommentsByAlertId.bind(controller));
	router.post('/:alertId/comments', controller.createComment.bind(controller));
	router.patch('/comments/:commentId', controller.updateComment.bind(controller));
	router.delete('/comments/:commentId', controller.deleteComment.bind(controller));

	// Alert History
	router.get('/:alertId/history', controller.getAlertHistory.bind(controller));

	// Create custom alerts
	router.post('/custom/datadog', controller.createCustomDatadogAlert.bind(controller));
	router.post('/custom/gcp', controller.createCustomGCPAlert.bind(controller));
	router.post('/custom/uptimekuma', controller.createUptimeKumaAlert.bind(controller));
	router.post('/custom', controller.createCustomAlert.bind(controller));

	return router;
}
