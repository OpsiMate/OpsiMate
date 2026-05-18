import { Request, Response } from 'express';
import {
	AlertSilenceIdSchema,
	CreateAlertSilenceSchema,
	Logger,
	UpdateAlertSilenceSchema,
} from '@OpsiMate/shared';
import { SilenceBL } from '../../../bl/silences/silence.bl';
import { isZodError } from '../../../utils/isZodError';

const logger = new Logger('api/v1/silences/controller');

export class SilenceController {
	constructor(private silenceBL: SilenceBL) {}

	listHandler = async (_req: Request, res: Response) => {
		try {
			const silences = await this.silenceBL.list();
			return res.json({ success: true, data: silences });
		} catch (error) {
			logger.error('Error listing silences', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	getHandler = async (req: Request, res: Response) => {
		try {
			const { silenceId } = AlertSilenceIdSchema.parse({ silenceId: req.params.silenceId });
			const silence = await this.silenceBL.get(silenceId);
			if (!silence) {
				return res.status(404).json({ success: false, error: 'Silence not found' });
			}
			return res.json({ success: true, data: silence });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error getting silence', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	createHandler = async (req: Request, res: Response) => {
		try {
			const data = CreateAlertSilenceSchema.parse(req.body);
			const silence = await this.silenceBL.create({
				name: data.name,
				nameContains: data.nameContains ?? null,
				labelMatchers: data.labelMatchers ?? [],
				startsAt: data.startsAt ?? null,
				endsAt: data.endsAt ?? null,
				schedule: data.schedule ?? null,
				reason: data.reason ?? null,
			});
			return res.status(201).json({ success: true, data: silence, message: 'Silence created' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error creating silence', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateHandler = async (req: Request, res: Response) => {
		try {
			const { silenceId } = AlertSilenceIdSchema.parse({ silenceId: req.params.silenceId });
			const data = UpdateAlertSilenceSchema.parse(req.body);

			const existing = await this.silenceBL.get(silenceId);
			if (!existing) {
				return res.status(404).json({ success: false, error: 'Silence not found' });
			}

			const updated = await this.silenceBL.update(silenceId, data);
			return res.json({ success: true, data: updated, message: 'Silence updated' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error updating silence', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	deleteHandler = async (req: Request, res: Response) => {
		try {
			const { silenceId } = AlertSilenceIdSchema.parse({ silenceId: req.params.silenceId });
			const existing = await this.silenceBL.get(silenceId);
			if (!existing) {
				return res.status(404).json({ success: false, error: 'Silence not found' });
			}
			await this.silenceBL.delete(silenceId);
			return res.json({ success: true, message: 'Silence deleted' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error deleting silence', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
