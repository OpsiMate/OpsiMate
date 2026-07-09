/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { MutePolicyController } from './controller';

export default function createMutePolicyRouter(mutePolicyController: MutePolicyController) {
	const router = PromiseRouter();

	router.get('/', mutePolicyController.listHandler);
	router.post('/', mutePolicyController.createHandler);
	router.get('/:mutePolicyId', mutePolicyController.getHandler);
	router.put('/:mutePolicyId', mutePolicyController.updateHandler);
	router.delete('/:mutePolicyId', mutePolicyController.deleteHandler);

	return router;
}
