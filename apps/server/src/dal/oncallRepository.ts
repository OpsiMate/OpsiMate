import Database from 'better-sqlite3';
import { runAsync } from './db';
import { ForeignKeyInfoRow, OncallTeamMemberRow, OncallTeamRow } from './models';

export class OncallRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async initOncallTables(): Promise<void> {
		return runAsync(() => {
			this.db.exec(`
				CREATE TABLE IF NOT EXISTS oncall_teams (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					rotation_interval_days INTEGER,
					rotation_anchor TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				);

				CREATE TABLE IF NOT EXISTS oncall_team_members (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					team_id INTEGER NOT NULL REFERENCES oncall_teams(id) ON DELETE CASCADE,
					user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
					position INTEGER NOT NULL,
					UNIQUE(team_id, user_id)
				);
			`);

			// Migration: early versions created the user_id FK without ON DELETE CASCADE, so
			// deleting a user who was on a team threw an FK error. SQLite can't alter an FK
			// in place — rebuild the table when the old shape is detected.
			const fks = this.db.prepare(`PRAGMA foreign_key_list(oncall_team_members)`).all() as ForeignKeyInfoRow[];
			const userFk = fks.find((fk) => fk.from === 'user_id');
			if (userFk && userFk.on_delete !== 'CASCADE') {
				const rebuild = this.db.transaction(() => {
					this.db.exec(`
						CREATE TABLE oncall_team_members_new (
							id INTEGER PRIMARY KEY AUTOINCREMENT,
							team_id INTEGER NOT NULL REFERENCES oncall_teams(id) ON DELETE CASCADE,
							user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
							position INTEGER NOT NULL,
							UNIQUE(team_id, user_id)
						);
						INSERT INTO oncall_team_members_new (id, team_id, user_id, position)
							SELECT id, team_id, user_id, position FROM oncall_team_members;
						DROP TABLE oncall_team_members;
						ALTER TABLE oncall_team_members_new RENAME TO oncall_team_members;
					`);
				});
				rebuild();
			}
		});
	}

	async getAllTeams(): Promise<OncallTeamRow[]> {
		return runAsync(() => {
			return this.db.prepare('SELECT * FROM oncall_teams ORDER BY name').all() as OncallTeamRow[];
		});
	}

	async getTeam(teamId: number): Promise<OncallTeamRow | null> {
		return runAsync(() => {
			const row = this.db.prepare('SELECT * FROM oncall_teams WHERE id = ?').get(teamId) as
				| OncallTeamRow
				| undefined;
			return row ?? null;
		});
	}

	// Members in base order (position), joined with the user fields the page displays.
	async getTeamMembers(teamId: number): Promise<OncallTeamMemberRow[]> {
		return runAsync(() => {
			return this.db
				.prepare(
					`
					SELECT m.id, m.team_id, m.user_id, m.position, u.full_name, u.email, u.phone_number
					FROM oncall_team_members m
					JOIN users u ON u.id = m.user_id
					WHERE m.team_id = ?
					ORDER BY m.position
				`
				)
				.all(teamId) as OncallTeamMemberRow[];
		});
	}

	async createTeam(name: string, rotationIntervalDays: number | null): Promise<number> {
		return runAsync(() => {
			const result = this.db
				.prepare(`INSERT INTO oncall_teams (name, rotation_interval_days, rotation_anchor) VALUES (?, ?, ?)`)
				.run(name, rotationIntervalDays, new Date().toISOString());
			return result.lastInsertRowid as number;
		});
	}

	// Changing the rotation interval resets the anchor: the current order stays put and the
	// new cadence counts from now.
	async updateTeam(teamId: number, updates: { name?: string; rotationIntervalDays?: number | null }): Promise<void> {
		return runAsync(() => {
			const setClauses: string[] = [];
			const values: (string | number | null)[] = [];
			if (updates.name !== undefined) {
				setClauses.push('name = ?');
				values.push(updates.name);
			}
			if (updates.rotationIntervalDays !== undefined) {
				setClauses.push('rotation_interval_days = ?', 'rotation_anchor = ?');
				values.push(updates.rotationIntervalDays, new Date().toISOString());
			}
			if (setClauses.length === 0) return;
			values.push(teamId);
			this.db.prepare(`UPDATE oncall_teams SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
		});
	}

	async deleteTeam(teamId: number): Promise<void> {
		return runAsync(() => {
			const remove = this.db.transaction(() => {
				this.db.prepare('DELETE FROM oncall_team_members WHERE team_id = ?').run(teamId);
				this.db.prepare('DELETE FROM oncall_teams WHERE id = ?').run(teamId);
			});
			remove();
		});
	}

	// Replaces the member list with the given ordered user ids and resets the rotation
	// anchor — the new order IS the current call order, and rotation counts from now.
	async setTeamMembers(teamId: number, userIds: number[]): Promise<void> {
		return runAsync(() => {
			const replace = this.db.transaction(() => {
				this.db.prepare('DELETE FROM oncall_team_members WHERE team_id = ?').run(teamId);
				const insert = this.db.prepare(
					'INSERT INTO oncall_team_members (team_id, user_id, position) VALUES (?, ?, ?)'
				);
				userIds.forEach((userId, position) => insert.run(teamId, userId, position));
				this.db
					.prepare('UPDATE oncall_teams SET rotation_anchor = ? WHERE id = ?')
					.run(new Date().toISOString(), teamId);
			});
			replace();
		});
	}
}
