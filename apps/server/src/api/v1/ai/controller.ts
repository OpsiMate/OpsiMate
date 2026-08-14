import { Response } from 'express';
import { Logger, Role, UpdateAiConfigSchema } from '@OpsiMate/shared';
import { AiBL } from '../../../bl/ai/ai.bl';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { isZodError } from '../../../utils/isZodError.ts';

const logger = new Logger('ai.controller');

export class AiController {
	constructor(private aiBL: AiBL) {}

	// Org-wide configuration holding a credential — admin-only, same gate the
	// retention and silence-reset settings use.
	private requireAdmin(req: AuthenticatedRequest, res: Response): boolean {
		if (!req.user || req.user.role !== Role.Admin) {
			res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
			return false;
		}
		return true;
	}

	getConfigHandler = async (req: AuthenticatedRequest, res: Response) => {
		if (!this.requireAdmin(req, res)) return;
		try {
			const config = await this.aiBL.getConfig();
			return res.json({ success: true, data: config });
		} catch (error) {
			logger.error('Error getting AI config:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateConfigHandler = async (req: AuthenticatedRequest, res: Response) => {
		if (!this.requireAdmin(req, res)) return;
		try {
			const updates = UpdateAiConfigSchema.parse(req.body ?? {});
			const config = await this.aiBL.updateConfig(updates, req.user);
			return res.json({ success: true, data: config });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error updating AI config:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	testConnectionHandler = async (req: AuthenticatedRequest, res: Response) => {
		if (!this.requireAdmin(req, res)) return;
		try {
			const result = await this.aiBL.testConnection();
			// Always 200: a failed Bedrock call is a RESULT the user asked for, not a
			// server error — the payload carries ok=false plus Bedrock's reason.
			return res.json({ success: true, data: result });
		} catch (error) {
			logger.error('Error testing AI connection:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
