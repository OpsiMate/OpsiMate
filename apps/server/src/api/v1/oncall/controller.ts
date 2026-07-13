import { Logger, OncallTeamMembersSchema, OncallTeamSchema, Role } from '@OpsiMate/shared';
import { Response } from 'express';
import { OncallBL } from '../../../bl/oncall/oncall.bl';
import { AuthenticatedRequest } from '../../../middleware/auth.ts';
import { isZodError } from '../../../utils/isZodError';

const logger = new Logger('api/v1/oncall/controller');

export class OncallController {
	constructor(private oncallBL: OncallBL) {}

	// Reading the schedule is open to any authenticated user (the NOC needs it);
	// changing it is admins only.
	private requireAdmin(req: AuthenticatedRequest, res: Response): boolean {
		if (!req.user || req.user.role !== Role.Admin) {
			res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
			return false;
		}
		return true;
	}

	private parseTeamId(req: AuthenticatedRequest, res: Response): number | null {
		const teamId = parseInt(req.params.teamId, 10);
		if (isNaN(teamId) || teamId <= 0) {
			res.status(400).json({ success: false, error: 'Invalid team id' });
			return null;
		}
		return teamId;
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
		if (!this.requireAdmin(req, res)) return;
		try {
			const { name, rotationIntervalDays } = OncallTeamSchema.parse(req.body);
			const team = await this.oncallBL.createTeam(name, rotationIntervalDays ?? null);
			return res.status(201).json({ success: true, data: { team } });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error creating on-call team', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	updateTeamHandler = async (req: AuthenticatedRequest, res: Response) => {
		if (!this.requireAdmin(req, res)) return;
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
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error updating on-call team', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	deleteTeamHandler = async (req: AuthenticatedRequest, res: Response) => {
		if (!this.requireAdmin(req, res)) return;
		const teamId = this.parseTeamId(req, res);
		if (teamId === null) return;
		try {
			await this.oncallBL.deleteTeam(teamId);
			return res.json({ success: true, message: 'Team deleted' });
		} catch (error) {
			logger.error('Error deleting on-call team', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	setTeamMembersHandler = async (req: AuthenticatedRequest, res: Response) => {
		if (!this.requireAdmin(req, res)) return;
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
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			}
			logger.error('Error setting on-call team members', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
