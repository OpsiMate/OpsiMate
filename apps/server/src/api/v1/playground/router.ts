import { Router } from 'express';
import { PlaygroundController } from './controller';

export default function createPlaygroundRouter(controller: PlaygroundController) {
	const router = Router();

	router.post('/book-demo', controller.bookDemoHandler);

	return router;
}
