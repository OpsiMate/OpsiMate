import { Response } from 'express';
import { LdapTestRequestSchema, Logger, UpdateLdapSettingsSchema } from '@OpsiMate/shared';
import {
	LdapSettingsBL,
	LdapSettingsManagedError,
	LdapSettingsValidationError,
} from '../../../bl/ldap/ldapSettings.bl';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { isZodError } from '../../../utils/isZodError.ts';

const logger = new Logger('ldap.controller');

// Admin-only: directory (LDAP) login settings.
export class LdapController {
	constructor(private ldapSettingsBL: LdapSettingsBL) {}

	getSettingsHandler = async (_req: AuthenticatedRequest, res: Response) => {
		try {
			return res.json({ success: true, data: await this.ldapSettingsBL.getSettings() });
		} catch (error) {
			logger.error('Error getting LDAP settings:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateSettingsHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const updates = UpdateLdapSettingsSchema.parse(req.body ?? {});
			const settings = await this.ldapSettingsBL.updateSettings(updates, req.user);
			return res.json({ success: true, data: settings });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			if (error instanceof LdapSettingsValidationError) {
				return res.status(400).json({ success: false, error: error.message, details: error.problems });
			}
			if (error instanceof LdapSettingsManagedError) {
				return res.status(409).json({ success: false, error: error.message });
			}
			logger.error('Error updating LDAP settings:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	testHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { email } = LdapTestRequestSchema.parse(req.body ?? {});
			return res.json({ success: true, data: await this.ldapSettingsBL.test(email) });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error testing LDAP settings:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
