import { Router } from 'express';
import { AlertController } from './controller';

export default function createAlertRouter(controller: AlertController) {
	const router = Router();

	// CRUD
	router.get('/', controller.getAlerts.bind(controller));
	router.get('/facets', controller.getAlertFacets.bind(controller));
	router.get('/analytics', controller.getAlertAnalytics.bind(controller));
	router.get('/groups', controller.getAlertGroupSummaries.bind(controller));

	// Bulk actions — one request over an id list or over every alert matching a query
	// (must be before /:alertId to avoid route conflicts)
	router.post('/bulk', controller.bulkAlertAction.bind(controller));

	// Daily silence reset settings (admin; must be before /:alertId to avoid route conflicts)
	router.get('/silence-reset', controller.getSilenceResetSettings.bind(controller));
	router.put('/silence-reset', controller.updateSilenceResetSettings.bind(controller));

	// Resolved alerts (must be before /:alertId to avoid route conflicts)
	router.get('/resolved', controller.getResolvedAlerts.bind(controller));
	router.get('/resolved/facets', controller.getResolvedAlertFacets.bind(controller));
	router.get('/resolved/groups', controller.getResolvedAlertGroupSummaries.bind(controller));
	router.delete('/resolved/:alertId', controller.deleteResolvedAlert.bind(controller));
	router.patch('/resolved/:id/owner', controller.setResolvedAlertOwner.bind(controller));
	router.patch('/resolved/:id/unresolve', controller.unresolveAlert.bind(controller));

	// Delete alert (parameterized route must come after specific routes)
	router.delete('/:alertId', controller.deleteAlert.bind(controller));

	// Silence Unsimiss an alert
	router.patch('/:id/silence', controller.silenceAlert.bind(controller));
	router.patch('/:id/unsilence', controller.unsilenceAlert.bind(controller));
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

	// Root cause: pushed by external systems (PUT), read on drawer-open (GET), rated
	// by operators (POST) — see AlertController's root-cause region.
	router.put('/:alertId/root-cause', controller.upsertRootCause.bind(controller));
	router.get('/:alertId/root-cause', controller.getRootCause.bind(controller));
	router.post('/:alertId/root-cause/rating', controller.rateRootCause.bind(controller));

	// Create custom alerts
	router.post('/custom/datadog', controller.createCustomDatadogAlert.bind(controller));
	router.post('/custom/grafana', controller.createCustomGrafanaAlert.bind(controller));
	router.post('/custom/gcp', controller.createCustomGCPAlert.bind(controller));
	router.post('/custom/uptimekuma', controller.createUptimeKumaAlert.bind(controller));
	router.post('/custom/zabbix', controller.createZabbixAlert.bind(controller));
	router.post('/custom', controller.createCustomAlert.bind(controller));

	return router;
}
