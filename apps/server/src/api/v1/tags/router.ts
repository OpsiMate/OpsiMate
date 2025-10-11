/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { TagController } from './controller.js';

export default function createTagRouter(tagController: TagController) {
    const router = PromiseRouter();

    // Tag management routes
    router.get('/', tagController.getAllTagsHandler);
    router.post('/', tagController.createTagHandler);

    // Parameterized tag routes
    router.get('/:tagId', tagController.getTagByIdHandler);
    router.put('/:tagId', tagController.updateTagHandler);
    router.delete('/:tagId', tagController.deleteTagHandler);

    return router;
}
