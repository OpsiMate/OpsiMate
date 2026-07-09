import { Request, Response } from 'express';
import { MutePolicyIdSchema, CreateMutePolicySchema, Logger, UpdateMutePolicySchema } from '@OpsiMate/shared';
import { MutePolicyBL } from '../../../bl/mute-policies/mutePolicy.bl';
import { isZodError } from '../../../utils/isZodError';

const logger = new Logger('api/v1/mute-policies/controller');

export class MutePolicyController {
	constructor(private mutePolicyBL: MutePolicyBL) {}

	listHandler = async (_req: Request, res: Response) => {
		try {
			const mutePolicies = await this.mutePolicyBL.list();
			return res.json({ success: true, data: mutePolicies });
		} catch (error) {
			logger.error('Error listing mute policies', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	getHandler = async (req: Request, res: Response) => {
		try {
			const { mutePolicyId } = MutePolicyIdSchema.parse({ mutePolicyId: req.params.mutePolicyId });
			const mutePolicy = await this.mutePolicyBL.get(mutePolicyId);
			if (!mutePolicy) {
				return res.status(404).json({ success: false, error: 'Mute policy not found' });
			}
			return res.json({ success: true, data: mutePolicy });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error getting mute policy', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	createHandler = async (req: Request, res: Response) => {
		try {
			const data = CreateMutePolicySchema.parse(req.body);
			const mutePolicy = await this.mutePolicyBL.create({
				name: data.name,
				nameContains: data.nameContains ?? null,
				labelMatchers: data.labelMatchers ?? [],
				startsAt: data.startsAt ?? null,
				endsAt: data.endsAt ?? null,
				schedule: data.schedule ?? null,
				reason: data.reason ?? null,
			});
			return res.status(201).json({ success: true, data: mutePolicy, message: 'Mute policy created' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error creating mute policy', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateHandler = async (req: Request, res: Response) => {
		try {
			const { mutePolicyId } = MutePolicyIdSchema.parse({ mutePolicyId: req.params.mutePolicyId });
			const data = UpdateMutePolicySchema.parse(req.body);

			const existing = await this.mutePolicyBL.get(mutePolicyId);
			if (!existing) {
				return res.status(404).json({ success: false, error: 'Mute policy not found' });
			}

			const updated = await this.mutePolicyBL.update(mutePolicyId, data);
			return res.json({ success: true, data: updated, message: 'Mute policy updated' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error updating mute policy', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	deleteHandler = async (req: Request, res: Response) => {
		try {
			const { mutePolicyId } = MutePolicyIdSchema.parse({ mutePolicyId: req.params.mutePolicyId });
			const existing = await this.mutePolicyBL.get(mutePolicyId);
			if (!existing) {
				return res.status(404).json({ success: false, error: 'Mute policy not found' });
			}
			await this.mutePolicyBL.delete(mutePolicyId);
			return res.json({ success: true, message: 'Mute policy deleted' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error deleting mute policy', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
