import { Request, Response } from 'express';
import { AuditBL } from '../../../bl/audit/audit.bl';
import { Logger } from '@OpsiMate/shared';

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

		const validateTime = (timeParam: string | undefined, paramName: string): Date | null => {
			if (!timeParam) return null;

			const timeDate = new Date(timeParam);
			if (isNaN(timeDate.getTime())) {
				throw new Error(`Invalid ${paramName} format. Expected ISO 8601 format.`);
			}
			return timeDate;
		};

		let startDate: Date | null = null;
		let endDate: Date | null = null;
		try {
			startDate = validateTime(startTime, 'startTime');
			endDate = validateTime(endTime, 'endTime');
		} catch (error) {
			return res.status(400).json({
				success: false,
				error: (error as Error).message,
			});
		}

		if (startDate && endDate && startDate > endDate) {
			return res.status(400).json({ success: false, error: 'startTime must be before endTime' });
		}
		const convertToUTC = (date: Date | null): string | undefined => {
			if (!date) return undefined;
			return date.toISOString().replace('T', ' ').substring(0, 19);
		};
		const filters = {
			userName: typeof req.query.userName === 'string' ? req.query.userName : undefined,
			actionType: typeof req.query.actionType === 'string' ? req.query.actionType : undefined,
			resourceType: typeof req.query.resourceType === 'string' ? req.query.resourceType : undefined,
			resourceName: typeof req.query.resourceName === 'string' ? req.query.resourceName : undefined,
			startTime: convertToUTC(startDate),
			endTime: convertToUTC(endDate),
		};

		try {
			const result = await this.auditBL.getAuditLogsPaginated(page, pageSize, filters);
			return res.json({
			    success: true, 
				data:result,
			    ...result	
		     });
		} catch (error) {
			logger.error('Error fetching audit logs:', error);
			return res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
		}
	};
}
