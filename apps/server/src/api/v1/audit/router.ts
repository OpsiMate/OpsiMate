/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express';
import { AuditController } from './controller';

export default function createAuditRouter(auditController: AuditController) {
    const router = Router();
    router.get('/', auditController.getAuditLogsPaginated);
    return router;
} 