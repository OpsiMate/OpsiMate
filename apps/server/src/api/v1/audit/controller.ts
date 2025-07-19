import { Request, Response } from 'express';
import { AuditBL } from '../../../bl/audit.bl';
import {Logger} from "@service-peek/shared";

const logger = new Logger('api/v1/audit/controller');

export class AuditController {
    constructor(private auditBL: AuditBL) {}

    getAuditLogsPaginated = async (req: Request, res: Response) => {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;
        try {
            const result = await this.auditBL.getAuditLogsPaginated(page, pageSize);
            // result.logs now includes userName and resourceName
            res.json(result);
        } catch (error) {
            logger.error('Error fetching audit logs:', error);
            res.status(500).json({ error: 'Failed to fetch audit logs' });
        }
    };
} 