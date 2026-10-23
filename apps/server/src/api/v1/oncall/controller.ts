import { Logger, OncallTeamMembersSchema, OncallTeamSchema, positiveIntegerIdSchema } from '@OpsiMate/shared';
import { Response } from 'express';
import { DuplicateTeamNameError, OncallBL, UnknownUserIdsError } from '../../../bl/oncall/oncall.bl';
import { AuthenticatedRequest } from '../../../middleware/auth.ts';
import { isZodError } from '../../../utils/isZodError';
import { routeParam } from '../../../utils/routeParams';

const logger = new Logger('api/v1/oncall/controller');

export class OncallController {
	constructor(private oncallBL: OncallBL) {}

	private parseTeamId(req: AuthenticatedRequest, res: Response): number | null {
		const parsedTeamId = positiveIntegerIdSchema.safeParse(routeParam(req, 'teamId'));
		if (!parsedTeamId.success) {
			res.status(400).json({ success: false, error: 'Invalid team id' });
			return null;
		}
		return parsedTeamId.data;
	}

	listTeamsHandler = async (_req: AuthenticatedRequest, res: Response) => {
		try {
			const teams = await this.oncallBL.getAllTeams();
			return res.json({ success: true, data: { teams } });
		} catch (error) {
			logger.error('Error listing on-call teams', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	createTeamHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { name, rotationIntervalDays } = OncallTeamSchema.parse(req.body);
			const team = await this.oncallBL.createTeam(name, rotationIntervalDays ?? null);
			return res.status(201).json({ success: true, data: { team } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			if (error instanceof DuplicateTeamNameError) {
				return res.status(409).json({ success: false, error: error.message });
			}
			logger.error('Error creating on-call team', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateTeamHandler = async (req: AuthenticatedRequest, res: Response) => {
		const teamId = this.parseTeamId(req, res);
		if (teamId === null) return;
		try {
			const updates = OncallTeamSchema.partial().parse(req.body);
			const team = await this.oncallBL.updateTeam(teamId, updates);
			if (!team) {
				return res.status(404).json({ success: false, error: 'Team not found' });
			}
			return res.json({ success: true, data: { team } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			if (error instanceof DuplicateTeamNameError) {
				return res.status(409).json({ success: false, error: error.message });
			}
			logger.error('Error updating on-call team', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	deleteTeamHandler = async (req: AuthenticatedRequest, res: Response) => {
		const teamId = this.parseTeamId(req, res);
		if (teamId === null) return;
		try {
			const deleted = await this.oncallBL.deleteTeam(teamId);
			if (!deleted) {
				return res.status(404).json({ success: false, error: 'Team not found' });
			}
			return res.json({ success: true, message: 'Team deleted' });
		} catch (error) {
			logger.error('Error deleting on-call team', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	setTeamMembersHandler = async (req: AuthenticatedRequest, res: Response) => {
		const teamId = this.parseTeamId(req, res);
		if (teamId === null) return;
		try {
			// The schema also rejects duplicate userIds.
			const { userIds } = OncallTeamMembersSchema.parse(req.body);
			const team = await this.oncallBL.setTeamMembers(teamId, userIds);
			if (!team) {
				return res.status(404).json({ success: false, error: 'Team not found' });
			}
			return res.json({ success: true, data: { team } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			}
			if (error instanceof UnknownUserIdsError) {
				return res.status(400).json({ success: false, error: error.message });
			}
			logger.error('Error setting on-call team members', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
