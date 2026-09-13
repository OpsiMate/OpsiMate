import { Request, Response } from 'express';
import { AuditBL } from '../../../bl/audit/audit.bl';
import { Logger } from '@OpsiMate/shared';
import { AuditListQueryParamsSchema } from './models';
import { isZodError } from '../../../utils/isZodError.ts';

const logger = new Logger('api/v1/audit/controller');

export class AuditController {
	constructor(private auditBL: AuditBL) {}

	getAuditLogsPaginated = async (req: Request, res: Response) => {
		try {
			const { page, pageSize } = AuditListQueryParamsSchema.parse(req.query);
			const result = await this.auditBL.getAuditLogsPaginated(page, pageSize);
			// result.logs now includes userName and resourceName
			return res.json({ success: true, data: result });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error fetching audit logs:', error);
			return res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
		}
	};
}
