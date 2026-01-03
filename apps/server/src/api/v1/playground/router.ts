import PromiseRouter from 'express-promise-router';
import { PlaygroundController } from './controller';

export default function createPlaygroundRouter(controller: PlaygroundController) {
	const router = PromiseRouter();

	router.post('/book-demo', controller.bookDemoHandler);

	return router;
}
