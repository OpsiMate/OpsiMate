import Database from 'better-sqlite3';
import { Action, ActionConfig, ActionType } from '@OpsiMate/shared';
import { runAsync } from './db';

interface ActionRow {
	id: number;
	name: string;
	type: string;
	config: string | null;
	created_at: string;
	updated_at: string;
}

export type CreateActionInput = Omit<Action, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateActionInput = Omit<Action, 'id' | 'createdAt' | 'updatedAt'>;

export class ActionRepository {
	constructor(private db: Database.Database) {}

	private toShared = (row: ActionRow): Action => {
		let config: ActionConfig = {} as ActionConfig;
		if (row.config) {
			try {
				const parsed: unknown = JSON.parse(row.config);
				if (parsed && typeof parsed === 'object') config = parsed as ActionConfig;
			} catch {
				config = {} as ActionConfig;
			}
		}
		return {
			id: row.id,
			name: row.name,
			type: row.type as ActionType,
			config,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	};

	async initActionsTable(): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`
					CREATE TABLE IF NOT EXISTS actions (
						id           INTEGER PRIMARY KEY AUTOINCREMENT,
						name         TEXT NOT NULL,
						type         TEXT NOT NULL,
						config       TEXT,
						created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
					)
				`
				)
				.run();
		});
	}

	async createAction(data: CreateActionInput): Promise<{ lastID: number }> {
		return runAsync(() => {
			const stmt = this.db.prepare(`INSERT INTO actions (name, type, config) VALUES (?, ?, ?)`);
			const result = stmt.run(data.name, data.type, JSON.stringify(data.config ?? {}));
			return { lastID: result.lastInsertRowid as number };
		});
	}

	async getAllActions(): Promise<Action[]> {
		return runAsync(() => {
			const rows = this.db.prepare(`SELECT * FROM actions ORDER BY created_at DESC`).all() as ActionRow[];
			return rows.map(this.toShared);
		});
	}

	async getActionById(id: number): Promise<Action | undefined> {
		return runAsync(() => {
			const row = this.db.prepare(`SELECT * FROM actions WHERE id = ?`).get(id) as ActionRow | undefined;
			return row ? this.toShared(row) : undefined;
		});
	}

	async updateAction(id: number, data: UpdateActionInput): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(`UPDATE actions SET name = ?, type = ?, config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
				.run(data.name, data.type, JSON.stringify(data.config ?? {}), id);
		});
	}

	async deleteAction(id: number): Promise<void> {
		return runAsync(() => {
			this.db.prepare(`DELETE FROM actions WHERE id = ?`).run(id);
		});
	}
}
