import { Request, Response } from 'express';
import {
	LabelMatcherGroups,
	MutePolicyIdSchema,
	MutePolicyLabelMatcher,
	MutePolicySchedule,
	CreateMutePolicySchema,
	Logger,
	UpdateMutePolicySchema,
} from '@OpsiMate/shared';
import { MutePolicyBL } from '../../../bl/mute-policies/mutePolicy.bl';
import { AuthenticatedRequest } from '../../../middleware/auth.ts';
import { isZodError } from '../../../utils/isZodError';

const logger = new Logger('api/v1/mute-policies/controller');

// The policy as it will read after the update: the stored values with the request
// fields on top, merged the way the repository writes. The name fields serialize to
// one column and the label fields to one, so when the body touches either member of a
// pair the stored member of that pair is replaced by what the body has (a missing one
// counts as empty). The create refinements run against THIS object, not the body,
// because a body field only ever narrows or replaces what is stored.
interface MergedMutePolicy {
	name: string;
	nameContains: string | null;
	nameContainsAny: string[];
	labelMatchers: MutePolicyLabelMatcher[];
	labelMatcherGroups: LabelMatcherGroups;
	matchAll: boolean;
	startsAt: string | null;
	endsAt: string | null;
	schedule: MutePolicySchedule | null;
	reason: string | null;
}

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
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error getting mute policy', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	createHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const data = CreateMutePolicySchema.parse(req.body);
			const mutePolicyData = {
				name: data.name,
				nameContains: data.nameContains ?? null,
				nameContainsAny: data.nameContainsAny ?? null,
				labelMatchers: data.labelMatchers ?? [],
				labelMatcherGroups: data.labelMatcherGroups,
				matchAll: data.matchAll ?? false,
				startsAt: data.startsAt ?? null,
				endsAt: data.endsAt ?? null,
				schedule: data.schedule ?? null,
				reason: data.reason ?? null,
			};
			const mutePolicy = await this.mutePolicyBL.create(mutePolicyData, req.user);
			return res.status(201).json({ success: true, data: mutePolicy, message: 'Mute policy created' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error creating mute policy', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { mutePolicyId } = MutePolicyIdSchema.parse({ mutePolicyId: req.params.mutePolicyId });
			const data = UpdateMutePolicySchema.parse(req.body);

			const existing = await this.mutePolicyBL.get(mutePolicyId);
			if (!existing) {
				return res.status(404).json({ success: false, error: 'Mute policy not found' });
			}

			// Validate the policy as it will read after the update, not just the
			// fields in the body. The stored side and the body side merge the way
			// the repository writes the columns: name and label criteria each
			// serialize to one column, so touching either field of a pair replaces
			// the whole pair with what the body has (a missing one counts as
			// empty). A plain spread would keep the stored pair member and let
			// edits through that create refuses (window + schedule, no criteria,
			// end before start).
			const hasName = data.nameContains !== undefined || data.nameContainsAny !== undefined;
			const hasLabel = data.labelMatchers !== undefined || data.labelMatcherGroups !== undefined;
			const merged: MergedMutePolicy = {
				name: data.name !== undefined ? data.name : existing.name,
				nameContains: hasName ? (data.nameContains ?? null) : (existing.nameContains ?? null),
				nameContainsAny: hasName ? (data.nameContainsAny ?? []) : (existing.nameContainsAny ?? []),
				labelMatchers: hasLabel ? (data.labelMatchers ?? []) : (existing.labelMatchers ?? []),
				labelMatcherGroups: hasLabel ? (data.labelMatcherGroups ?? []) : (existing.labelMatcherGroups ?? []),
				matchAll: data.matchAll !== undefined ? data.matchAll : !!existing.matchAll,
				startsAt: data.startsAt !== undefined ? data.startsAt : (existing.startsAt ?? null),
				endsAt: data.endsAt !== undefined ? data.endsAt : (existing.endsAt ?? null),
				schedule: data.schedule !== undefined ? data.schedule : (existing.schedule ?? null),
				reason: data.reason !== undefined ? data.reason : (existing.reason ?? null),
			};
			CreateMutePolicySchema.parse(merged);

			const updated = await this.mutePolicyBL.update(mutePolicyId, data, req.user);
			return res.json({ success: true, data: updated, message: 'Mute policy updated' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error updating mute policy', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	deleteHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { mutePolicyId } = MutePolicyIdSchema.parse({ mutePolicyId: req.params.mutePolicyId });
			const existing = await this.mutePolicyBL.get(mutePolicyId);
			if (!existing) {
				return res.status(404).json({ success: false, error: 'Mute policy not found' });
			}
			await this.mutePolicyBL.delete(mutePolicyId, req.user);
			return res.json({ success: true, message: 'Mute policy deleted' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			logger.error('Error deleting mute policy', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
