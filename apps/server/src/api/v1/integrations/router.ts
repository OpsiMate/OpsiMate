/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { IntegrationController } from './controller';

export default function createIntegrationRouter(controller: IntegrationController) {
	const router = PromiseRouter();

	// CRUD API
	router.get('/', controller.getIntegrations);
	router.post('/', controller.createIntegration);
	router.put('/:integrationId', controller.updateIntegration);
	router.delete('/:integrationId', controller.deleteIntegration);

	router.get('/:integrationId/urls', controller.getIntegrationUrls);
	router.post('/test-connection', controller.testIntegration);

	return router;
}
