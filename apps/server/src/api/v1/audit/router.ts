/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express';
import { AuditController } from './controller.js';
import PromiseRouter from "express-promise-router";

export default function createAuditRouter(auditController: AuditController): Router {
    const router = PromiseRouter();
    router.get('/', auditController.getAuditLogsPaginated);
    return router;
} 