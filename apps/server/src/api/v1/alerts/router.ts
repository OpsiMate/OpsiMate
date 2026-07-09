/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { AlertController } from './controller';

export default function createAlertRouter(controller: AlertController) {
	const router = PromiseRouter();

	// CRUD
	router.get('/', controller.getAlerts.bind(controller));

	// Resolved alerts (must be before /:alertId to avoid route conflicts)
	router.get('/resolved', controller.getResolvedAlerts.bind(controller));
	router.delete('/resolved/:alertId', controller.deleteResolvedAlert.bind(controller));
	router.patch('/resolved/:id/owner', controller.setResolvedAlertOwner.bind(controller));

	// Delete alert (parameterized route must come after specific routes)
	router.delete('/:alertId', controller.deleteAlert.bind(controller));

	// Dismiss Unsimiss an alert
	router.patch('/:id/dismiss', controller.dismissAlert.bind(controller));
	router.patch('/:id/undismiss', controller.undismissAlert.bind(controller));
	router.patch('/:id/read', controller.markAlertRead.bind(controller));

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
	router.post('/custom/grafana', controller.createCustomGrafanaAlert.bind(controller));
	router.post('/custom/gcp', controller.createCustomGCPAlert.bind(controller));
	router.post('/custom/uptimekuma', controller.createUptimeKumaAlert.bind(controller));
	router.post('/custom/zabbix', controller.createZabbixAlert.bind(controller));
	router.post('/custom', controller.createCustomAlert.bind(controller));

	return router;
}
