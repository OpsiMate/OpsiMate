import { Request, Response } from 'express';
import { AuditBL } from '../../../bl/audit/audit.bl.js';
import {Logger} from "@OpsiMate/shared";
import { success } from 'zod/v4';

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

        const convertTimeFormat = (timestamp: Date) => {
            return timestamp.toISOString().replace('T', ' ').substring(0, 19);
        };
    
        if (startTime) {
            const timeDate = new Date(startTime);    
            if (isNaN(timeDate.getTime())) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid startTime format. Expected ISO 8601 format.' 
                });
            }

            startTime = convertTimeFormat(timeDate);
        }
        
        if (endTime) {
            const timeDate = new Date(endTime);    
            if (isNaN(timeDate.getTime())) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid endTime format. Expected ISO 8601 format.' 
                });
            }

            endTime = convertTimeFormat(timeDate);
        }
  
        if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
            return res.status(400).json({ success: false, error: 'startTime must be before endTime' });
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