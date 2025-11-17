/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { ProviderController } from './controller';

export default function createProviderRouter(controller: ProviderController) {
	const router = PromiseRouter();

	// CRUD API
	router.get('/', controller.getProviders.bind(controller));
	router.post('/', controller.createProvider.bind(controller));
	router.post('/bulk', controller.createProviderBulk.bind(controller));

	// Provider-specific routes (with :providerId parameter)
	router.post('/:providerId/refresh', controller.refreshProvider.bind(controller));
	router.put('/:providerId', controller.updateProvider.bind(controller));
	router.delete('/:providerId', controller.deleteProvider.bind(controller));

	// Additional APIs
	router.post('/test-connection', controller.testConnection.bind(controller));
	router.get('/:providerId/discover-services', controller.discoverServices.bind(controller));

	return router;
}
