import { Request, Response } from 'express';
import {
	AlertCallbackIdSchema,
	CreateAlertCallbackSchema,
	Logger,
	TestAlertCallbackSchema,
	UpdateAlertCallbackSchema,
} from '@OpsiMate/shared';
import { CallbackBL } from '../../../bl/callbacks/callback.bl';
import { AuthenticatedRequest } from '../../../middleware/auth.ts';
import { isZodError } from '../../../utils/isZodError';

const logger = new Logger('api/v1/callbacks/controller');

export class CallbackController {
	constructor(private callbackBL: CallbackBL) {}

	listHandler = async (_req: Request, res: Response) => {
		try {
			const callbacks = await this.callbackBL.list();
			return res.json({ success: true, data: callbacks });
		} catch (error) {
			logger.error('Error listing callbacks', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	getHandler = async (req: Request, res: Response) => {
		try {
			const { callbackId } = AlertCallbackIdSchema.parse({ callbackId: req.params.callbackId });
			const callback = await this.callbackBL.get(callbackId);
			if (!callback) return res.status(404).json({ success: false, error: 'Callback not found' });
			return res.json({ success: true, data: callback });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error getting callback', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	createHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const data = CreateAlertCallbackSchema.parse(req.body);
			const callback = await this.callbackBL.create(
				{
					name: data.name,
					url: data.url,
					method: data.method,
					headers: data.headers ?? null,
					bodyTemplate: data.bodyTemplate ?? null,
					events: data.events,
					enabled: data.enabled,
					secret: data.secret,
				},
				req.user
			);
			return res.status(201).json({ success: true, data: callback, message: 'Callback created' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error creating callback', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	testHandler = async (req: Request, res: Response) => {
		try {
			const data = TestAlertCallbackSchema.parse(req.body);
			const result = await this.callbackBL.test({
				url: data.url,
				method: data.method,
				headers: data.headers ?? null,
				bodyTemplate: data.bodyTemplate ?? null,
				secret: data.secret ?? null,
			});
			return res.json({ success: true, data: result });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error testing callback', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { callbackId } = AlertCallbackIdSchema.parse({ callbackId: req.params.callbackId });
			const data = UpdateAlertCallbackSchema.parse(req.body);
			const existing = await this.callbackBL.get(callbackId);
			if (!existing) return res.status(404).json({ success: false, error: 'Callback not found' });
			const updated = await this.callbackBL.update(callbackId, data, req.user);
			return res.json({ success: true, data: updated, message: 'Callback updated' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error updating callback', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	deleteHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { callbackId } = AlertCallbackIdSchema.parse({ callbackId: req.params.callbackId });
			const existing = await this.callbackBL.get(callbackId);
			if (!existing) return res.status(404).json({ success: false, error: 'Callback not found' });
			await this.callbackBL.delete(callbackId, req.user);
			return res.json({ success: true, message: 'Callback deleted' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error deleting callback', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
