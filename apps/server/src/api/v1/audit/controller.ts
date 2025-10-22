import { Request, Response } from 'express';
import { AuditBL } from '../../../bl/audit/audit.bl.js';
import {Logger} from "@OpsiMate/shared";

const logger = new Logger('api/v1/audit/controller');

export class AuditController {
    constructor(private auditBL: AuditBL) {}

    getAuditLogsPaginated = async (req: Request, res: Response) => {
       const pageRaw = parseInt(req.query.page as string);
       const sizeRaw = parseInt(req.query.pageSize as string);
       const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
       const pageSize = Math.min(Math.max(Number.isFinite(sizeRaw) ? sizeRaw : 20, 1), 100);
       const startTime = req.query.startTime as string | undefined;
       const endTime = req.query.endTime as string | undefined;
    
    // Optional: Validate that startTime <= endTime if both provided
    if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
        return res.status(400).json({ error: 'startTime must be before endTime' });
    } 
      
    const filters = {
        userName: req.query.userName as string | undefined,
        actionType: req.query.actionType as string | undefined,
        resourceType: req.query.resourceType as string | undefined,
        resourceName: req.query.resourceName as string | undefined,
        startTime,
        endTime,
    };
        try {
            const result = await this.auditBL.getAuditLogsPaginated(page, pageSize, filters);
            // result.logs now includes userName and resourceName
            return res.json({success: true, data: result });
        } catch (error) {
            logger.error('Error fetching audit logs:', error);
            return res.status(500).json({success: false, error: 'Failed to fetch audit logs' });
        }
    };
} 