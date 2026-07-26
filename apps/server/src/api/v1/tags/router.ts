import { Router } from 'express';
import { TagController } from './controller';

export default function createTagRouter(tagController: TagController) {
	const router = Router();

	// Tag management routes
	router.get('/', tagController.getAllTagsHandler);
	router.post('/', tagController.createTagHandler);

	// Parameterized tag routes
	router.get('/:tagId', tagController.getTagByIdHandler);
	router.put('/:tagId', tagController.updateTagHandler);
	router.delete('/:tagId', tagController.deleteTagHandler);

	return router;
}
