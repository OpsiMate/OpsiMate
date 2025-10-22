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
        let startTime = req.query.startTime as string | undefined;
        let endTime = req.query.endTime as string | undefined;

       const validateAndConvertTime = (timeParam: string | undefined, paramName: string): string | undefined => {
            if (!timeParam) return undefined;

            const timeDate = new Date(timeParam);
            if (isNaN(timeDate.getTime())) {
                throw new Error(`Invalid ${paramName} format. Expected ISO 8601 format.`);
            }
            return timeDate.toISOString().replace('T', ' ').substring(0, 19);
        };
    
        try {
           startTime = validateAndConvertTime(startTime,'startTime');
           endTime = validateAndConvertTime(endTime,'endTime');
        } catch(error) {
           return res.status(400).json({
             success:false,
             error: (error as Error).message
           });
        }
  
        if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
            return res.status(400).json({ success: false, error: 'startTime must be before endTime' });
        }

        const filters = {
            userName: typeof req.query.userName === 'string' ? req.query.userName : undefined,
            actionType: typeof req.query.actionType === 'string' ? req.query.actionType : undefined,
            resourceType: typeof req.query.resourceType === 'string' ? req.query.resourceType : undefined,
            resourceName: typeof req.query.resourceName === 'string' ? req.query.resourceName : undefined,
            startTime,
            endTime,
        };

        try {
            const result = await this.auditBL.getAuditLogsPaginated(page, pageSize, filters);
            return res.json({success: true, data: result });
        } catch (error) {
            logger.error('Error fetching audit logs:', error);
            return res.status(500).json({success: false, error: 'Failed to fetch audit logs' });
        }
    };
} 