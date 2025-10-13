/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { ServiceController } from './controller.js';
import {TagController} from "../tags/controller.js";

export default function createServiceRouter(serviceController: ServiceController, tagController: TagController) {
    const router = PromiseRouter();

    // POST /api/v1/integration/services
    router.post('/', serviceController.createServiceHandler);

    // GET /api/v1/integration/services
    router.get('/', serviceController.getAllServicesHandler);

    // GET /api/v1/integration/services/:serviceId
    router.get('/:serviceId', serviceController.getServiceByIdHandler);

    // PUT /api/v1/integration/services/:serviceId
    router.put('/:serviceId', serviceController.updateServiceHandler);

    // POST /api/v1/integration/services/:serviceId/start
    router.post('/:serviceId/start', serviceController.startServiceHandler);

    // POST /api/v1/integration/services/:serviceId/stop
    router.post('/:serviceId/stop', serviceController.stopServiceHandler);

    // GET /api/v1/integration/services/:serviceId/logs
    router.get('/:serviceId/logs', serviceController.getServiceLogsHandler);

    // DELETE /api/v1/integration/services/:serviceId
    router.delete('/:serviceId', serviceController.deleteServiceHandler);

    // GET /api/v1/integration/services/:serviceId/pods
    router.get('/:serviceId/pods', serviceController.getServicePodsHandler);


    // Service tag association routes
    router.post('/:serviceId/tags', tagController.addTagToServiceHandler);
    router.delete('/:serviceId/tags/:tagId', tagController.removeTagFromServiceHandler);
    router.get('/:serviceId/tags', tagController.getServiceTagsHandler);

    return router;
}
