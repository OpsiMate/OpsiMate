import { Request, Response } from 'express';
import {
	ActionIdSchema,
	CreateActionSchema,
	Logger,
	PreviewActionSchema,
	RunActionSchema,
	UpdateActionSchema,
} from '@OpsiMate/shared';
import { ActionBL } from '../../../bl/actions/action.bl';
import { AuthenticatedRequest } from '../../../middleware/auth.ts';
import { isZodError } from '../../../utils/isZodError';

const logger = new Logger('api/v1/actions/controller');

export class ActionController {
	constructor(private actionBL: ActionBL) {}

	listHandler = async (_req: Request, res: Response) => {
		try {
			const actions = await this.actionBL.list();
			return res.json({ success: true, data: actions });
		} catch (error) {
			logger.error('Error listing actions', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	getHandler = async (req: Request, res: Response) => {
		try {
			const { actionId } = ActionIdSchema.parse({ actionId: req.params.actionId });
			const action = await this.actionBL.get(actionId);
			if (!action) {
				return res.status(404).json({ success: false, error: 'Action not found' });
			}
			return res.json({ success: true, data: action });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error getting action', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	createHandler = async (req: Request, res: Response) => {
		try {
			const data = CreateActionSchema.parse(req.body);
			const action = await this.actionBL.create({
				name: data.name,
				type: data.type,
				config: data.config,
				nameContains: data.nameContains ?? null,
				labelMatchers: data.labelMatchers ?? [],
			});
			return res.status(201).json({ success: true, data: action, message: 'Action created' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error creating action', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	testHandler = async (req: Request, res: Response) => {
		try {
			const data = CreateActionSchema.parse(req.body);
			const result = await this.actionBL.test({ name: data.name, type: data.type, config: data.config });
			return res.json({ success: true, data: result });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error testing action', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	previewHandler = async (req: Request, res: Response) => {
		try {
			const { actionId } = ActionIdSchema.parse({ actionId: req.params.actionId });
			const { alert } = PreviewActionSchema.parse(req.body);
			const action = await this.actionBL.get(actionId);
			if (!action) {
				return res.status(404).json({ success: false, error: 'Action not found' });
			}
			const preview = this.actionBL.previewForAlert(action, alert);
			return res.json({ success: true, data: preview });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error previewing action', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	runHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { actionId } = ActionIdSchema.parse({ actionId: req.params.actionId });
			const { alert, overrides } = RunActionSchema.parse(req.body);
			const action = await this.actionBL.get(actionId);
			if (!action) {
				return res.status(404).json({ success: false, error: 'Action not found' });
			}
			const result = await this.actionBL.runOnAlert(action, alert, overrides, req.user?.fullName);
			return res.json({ success: true, data: result });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error running action on alert', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateHandler = async (req: Request, res: Response) => {
		try {
			const { actionId } = ActionIdSchema.parse({ actionId: req.params.actionId });
			const data = UpdateActionSchema.parse(req.body);

			const existing = await this.actionBL.get(actionId);
			if (!existing) {
				return res.status(404).json({ success: false, error: 'Action not found' });
			}

			const updated = await this.actionBL.update(actionId, {
				name: data.name,
				type: data.type,
				config: data.config,
				nameContains: data.nameContains ?? null,
				labelMatchers: data.labelMatchers ?? [],
			});
			return res.json({ success: true, data: updated, message: 'Action updated' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error updating action', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	deleteHandler = async (req: Request, res: Response) => {
		try {
			const { actionId } = ActionIdSchema.parse({ actionId: req.params.actionId });
			const existing = await this.actionBL.get(actionId);
			if (!existing) {
				return res.status(404).json({ success: false, error: 'Action not found' });
			}
			await this.actionBL.delete(actionId);
			return res.json({ success: true, message: 'Action deleted' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error deleting action', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
