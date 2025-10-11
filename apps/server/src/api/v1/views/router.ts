/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { ViewController } from './controller.js';

export default function createViewRouter(controller: ViewController) {
    const router = PromiseRouter();

    /**
     * Get all views
     */
    router.get('/', controller.getViewsHandler);

    /**
     * Get a specific view by ID
     */
    router.get('/:viewId', controller.getViewsByIdHandler);

    /**
     * Create or update a view
     */
    router.post('/', controller.createViewHandler);

    /**
     * Delete a view
     */
    router.delete('/:viewId', controller.deleteViewHandler);

    /**
     * Set active view
     */
    router.post('/active/:viewId', controller.setActiveViewHandler);

    /**
     * Get active view ID
     */
    router.get('/active', controller.getActiveViewHandler);

    return router;
}
