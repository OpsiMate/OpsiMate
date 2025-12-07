import { Logger } from '@OpsiMate/shared';
import { Request, Response } from 'express';
import { CustomActionBL } from '../../../bl/custom-actions/customAction.bl';
import { CustomAction } from '@OpsiMate/custom-actions';
import { z } from 'zod';
import { isZodError } from '../../../utils/isZodError.ts';

const logger: Logger = new Logger('api/custom-actions');

// Validation schema for BashAction (id is optional, will be ignored on create)
const BashActionSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	description: z.string().min(1, 'Description is required'),
	type: z.literal('bash'),
	target: z.enum(['service', 'provider']).nullable(),
	script: z.string().nullable(),
	id: z.number().optional(),
});

// Validation schema for HttpAction (id is optional, will be ignored on create)
const HttpActionSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	description: z.string().min(1, 'Description is required'),
	type: z.literal('http'),
	target: z.enum(['service', 'provider']).nullable(),
	url: z.string().url('Invalid URL format'),
	method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
	headers: z.record(z.string()).nullable().optional(),
	body: z.string().nullable().optional(),
	id: z.number().optional(),
});

// Union schema for both action types
const CustomActionSchema = z.discriminatedUnion('type', [BashActionSchema, HttpActionSchema]);

export class CustomActionsController {
	constructor(private bl: CustomActionBL) {}

	create = async (req: Request, res: Response) => {
		try {
			const validatedData = CustomActionSchema.parse(req.body);
			// Remove id if present (it's auto-generated) and create a proper CustomAction
			const { id: _, ...dataWithoutId } = validatedData;
			const actionData = { ...dataWithoutId, id: 0 } as CustomAction; // id will be ignored
			const id = await this.bl.create(actionData);
			return res.status(201).json({ success: true, data: { id } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error creating custom action:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	list = async (_: Request, res: Response) => {
		const data = await this.bl.list();
		return res.status(200).json({ success: true, data: { actions: data } });
	};

	getById = async (req: Request, res: Response) => {
		const id = Number(req.params.actionId);
		const data = await this.bl.getById(id);
		if (!data) return res.status(404).json({ success: false, error: 'Not found' });
		return res.status(200).json({ success: true, data });
	};

	update = async (req: Request, res: Response) => {
		try {
			const id = Number(req.params.actionId);
			const validatedData = CustomActionSchema.parse(req.body);
			// Remove id if present (use parameter id instead) and create a proper CustomAction
			const { id: _, ...dataWithoutId } = validatedData;
			const actionData = { ...dataWithoutId, id: 0 } as CustomAction; // id will be ignored
			await this.bl.update(id, actionData);
			return res.status(200).json({ success: true });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error updating custom action:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	delete = async (req: Request, res: Response) => {
		const id = Number(req.params.actionId);
		await this.bl.delete(id);
		return res.status(200).json({ success: true });
	};

	runForProvider = async (req: Request, res: Response) => {
		try {
			const providerId = Number(req.params.providerId);
			const actionId = Number(req.params.actionId);
			await this.bl.runForProvider(providerId, actionId);
			return res.status(200).json({ success: true });
		} catch (error) {
			if (error instanceof Error) {
				if (error.message === 'Action not found') {
					return res.status(404).json({ success: false, error: 'Action not found' });
				}
				if (error.name === 'ProviderNotFound' || error.message.includes('Provider not found')) {
					return res.status(404).json({ success: false, error: 'Provider not found' });
				}
			}
			logger.error('Error running custom action for provider:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	runForService = async (req: Request, res: Response) => {
		try {
			const serviceId = Number(req.params.serviceId);
			const actionId = Number(req.params.actionId);
			await this.bl.runForService(serviceId, actionId);
			return res.status(200).json({ success: true });
		} catch (error) {
			if (error instanceof Error) {
				if (error.message === 'Service not found' || error.message === 'Action not found') {
					return res.status(404).json({ success: false, error: error.message });
				}
				if (error.name === 'ProviderNotFound' || error.message.includes('Provider not found')) {
					return res.status(404).json({ success: false, error: 'Provider not found' });
				}
			}
			logger.error('Error running custom action for service:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
