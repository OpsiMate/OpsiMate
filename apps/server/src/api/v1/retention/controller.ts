import { Response } from 'express';
import {
	Logger,
	Role,
	UpdateRetentionConfigSchema,
	UpdateRetentionPolicySchema,
	RetentionResourceParamSchema,
} from '@OpsiMate/shared';
import { RetentionBL } from '../../../bl/retention/retention.bl';
import { AuthenticatedRequest } from '../../../middleware/auth.ts';
import { isZodError } from '../../../utils/isZodError';

const logger = new Logger('api/v1/retention/controller');

export class RetentionController {
	constructor(private retentionBL: RetentionBL) {}

	private requireAdmin(req: AuthenticatedRequest, res: Response): boolean {
		if (!req.user || req.user.role !== Role.Admin) {
			res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
			return false;
		}
		return true;
	}

	getSettings = async (req: AuthenticatedRequest, res: Response) => {
		if (!this.requireAdmin(req, res)) return;
		try {
			const settings = await this.retentionBL.getSettings();
			return res.json({ success: true, data: settings });
		} catch (error) {
			logger.error('Error getting retention settings', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateConfig = async (req: AuthenticatedRequest, res: Response) => {
		if (!this.requireAdmin(req, res)) return;
		try {
			const { cleanupIntervalHours } = UpdateRetentionConfigSchema.parse(req.body);
			const config = await this.retentionBL.updateConfig(cleanupIntervalHours);
			return res.json({ success: true, data: config });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error updating retention config', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updatePolicy = async (req: AuthenticatedRequest, res: Response) => {
		if (!this.requireAdmin(req, res)) return;
		try {
			const { resourceType } = RetentionResourceParamSchema.parse(req.params);
			const updates = UpdateRetentionPolicySchema.parse(req.body);
			const policy = await this.retentionBL.updatePolicy(resourceType, updates);
			return res.json({ success: true, data: policy });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error updating retention policy', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	runNow = async (req: AuthenticatedRequest, res: Response) => {
		if (!this.requireAdmin(req, res)) return;
		try {
			const result = await this.retentionBL.runCleanup();
			return res.json({ success: true, data: result });
		} catch (error) {
			logger.error('Error running retention cleanup', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
