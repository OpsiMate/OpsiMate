import { Logger, OncallTeam, OncallTeamMember } from '@OpsiMate/shared';
import { OncallRepository, OncallTeamUpdate } from '../../dal/oncallRepository';
import { OncallTeamMemberRow, OncallTeamRow } from './../../dal/models';

const logger = new Logger('bl/oncall.bl');

const DAY_MS = 24 * 60 * 60 * 1000;

// Thrown when a create/rename would collide with an existing team's name (the API
// maps it to 409). Names identify teams — alerts reference them by name.
export class DuplicateTeamNameError extends Error {
	constructor(name: string) {
		super(`A team named "${name}" already exists`);
	}
}

export class OncallBL {
	constructor(private oncallRepo: OncallRepository) {}

	// The rotation is pure arithmetic — no background job. Members hold a fixed base order
	// (position). Every `rotationIntervalDays` since the anchor, the on-call duty shifts one
	// place down the list: shift = floor(daysSinceAnchor / interval) mod memberCount, and the
	// member at base position `shift` is on call now (priority 1), followed by the rest in
	// base order, wrapping around.
	private toSharedTeam(team: OncallTeamRow, memberRows: OncallTeamMemberRow[], now: Date): OncallTeam {
		const interval = team.rotation_interval_days ?? 0;
		const count = memberRows.length;

		let shift = 0;
		let nextRotationAt: string | null = null;
		if (interval > 0 && count > 0) {
			const anchorMs = new Date(team.rotation_anchor).getTime();
			const elapsed = Math.max(0, now.getTime() - anchorMs);
			const periods = Math.floor(elapsed / (interval * DAY_MS));
			shift = periods % count;
			nextRotationAt = new Date(anchorMs + (periods + 1) * interval * DAY_MS).toISOString();
		}

		const members: OncallTeamMember[] = memberRows.map((row, index) => ({
			userId: String(row.user_id),
			fullName: row.full_name,
			email: row.email,
			phoneNumber: row.phone_number ?? null,
			// Rotate the base order by `shift`: the member at base position `shift` becomes
			// priority 1, the one before them wraps to the end. The dense index is used
			// (rows are position-ordered) rather than the stored position, which can have
			// gaps after a member's user is deleted (FK cascade) — gaps would make the
			// modulo assign duplicate priorities.
			priority: ((index - shift + count) % count) + 1,
		}));
		members.sort((a, b) => a.priority - b.priority);

		return {
			id: team.id,
			name: team.name,
			rotationIntervalDays: team.rotation_interval_days,
			rotationAnchor: team.rotation_anchor,
			members,
			nextRotationAt,
		};
	}

	async getAllTeams(): Promise<OncallTeam[]> {
		try {
			const now = new Date();
			const teams = await this.oncallRepo.getAllTeams();
			return await Promise.all(
				teams.map(async (team) => this.toSharedTeam(team, await this.oncallRepo.getTeamMembers(team.id), now))
			);
		} catch (error) {
			logger.error('Error fetching on-call teams', error);
			throw error;
		}
	}

	async getTeam(teamId: number): Promise<OncallTeam | null> {
		const team = await this.oncallRepo.getTeam(teamId);
		if (!team) return null;
		return this.toSharedTeam(team, await this.oncallRepo.getTeamMembers(teamId), new Date());
	}

	async createTeam(name: string, rotationIntervalDays: number | null): Promise<OncallTeam> {
		try {
			logger.info(`Creating on-call team: ${name}`);
			if (await this.oncallRepo.getTeamByName(name)) {
				throw new DuplicateTeamNameError(name);
			}
			const teamId = await this.oncallRepo.createTeam(name, rotationIntervalDays || null);
			return (await this.getTeam(teamId)) as OncallTeam;
		} catch (error) {
			logger.error('Error creating on-call team', error);
			throw error;
		}
	}

	async updateTeam(teamId: number, updates: OncallTeamUpdate): Promise<OncallTeam | null> {
		try {
			logger.info(`Updating on-call team ${teamId}`);
			const existing = await this.oncallRepo.getTeam(teamId);
			if (!existing) return null;
			if (updates.name !== undefined) {
				const clash = await this.oncallRepo.getTeamByName(updates.name);
				if (clash && clash.id !== teamId) {
					throw new DuplicateTeamNameError(updates.name);
				}
			}
			await this.oncallRepo.updateTeam(teamId, {
				...updates,
				...(updates.rotationIntervalDays !== undefined && {
					rotationIntervalDays: updates.rotationIntervalDays || null,
				}),
			});
			return this.getTeam(teamId);
		} catch (error) {
			logger.error(`Error updating on-call team ${teamId}`, error);
			throw error;
		}
	}

	async deleteTeam(teamId: number): Promise<void> {
		try {
			logger.info(`Deleting on-call team ${teamId}`);
			await this.oncallRepo.deleteTeam(teamId);
		} catch (error) {
			logger.error(`Error deleting on-call team ${teamId}`, error);
			throw error;
		}
	}

	async setTeamMembers(teamId: number, userIds: number[]): Promise<OncallTeam | null> {
		try {
			logger.info(`Setting members for on-call team ${teamId}: [${userIds.join(', ')}]`);
			const existing = await this.oncallRepo.getTeam(teamId);
			if (!existing) return null;
			await this.oncallRepo.setTeamMembers(teamId, userIds);
			return this.getTeam(teamId);
		} catch (error) {
			logger.error(`Error setting members for on-call team ${teamId}`, error);
			throw error;
		}
	}
}
