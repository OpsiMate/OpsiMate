import Database from 'better-sqlite3';
import { Action, ActionConfig, ActionLabelMatcher, ActionType } from '@OpsiMate/shared';
import { runAsync } from './db';

interface ActionRow {
	id: number;
	name: string;
	type: string;
	config: string | null;
	name_contains: string | null;
	label_matchers: string | null;
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
		let labelMatchers: ActionLabelMatcher[] = [];
		if (row.label_matchers) {
			try {
				const parsed: unknown = JSON.parse(row.label_matchers);
				if (Array.isArray(parsed)) labelMatchers = parsed as ActionLabelMatcher[];
			} catch {
				labelMatchers = [];
			}
		}
		return {
			id: row.id,
			name: row.name,
			type: row.type as ActionType,
			config,
			nameContains: row.name_contains,
			labelMatchers,
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
						id             INTEGER PRIMARY KEY AUTOINCREMENT,
						name           TEXT NOT NULL,
						type           TEXT NOT NULL,
						config         TEXT,
						name_contains  TEXT,
						label_matchers TEXT,
						created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
					)
				`
				)
				.run();

			// Migrate older installs that predate the alert-filter columns.
			const columns = this.db.prepare(`PRAGMA table_info(actions)`).all() as { name: string }[];
			if (!columns.some((c) => c.name === 'name_contains')) {
				this.db.prepare(`ALTER TABLE actions ADD COLUMN name_contains TEXT`).run();
			}
			if (!columns.some((c) => c.name === 'label_matchers')) {
				this.db.prepare(`ALTER TABLE actions ADD COLUMN label_matchers TEXT`).run();
			}
		});
	}

	async createAction(data: CreateActionInput): Promise<{ lastID: number }> {
		return runAsync(() => {
			const stmt = this.db.prepare(
				`INSERT INTO actions (name, type, config, name_contains, label_matchers) VALUES (?, ?, ?, ?, ?)`
			);
			const result = stmt.run(
				data.name,
				data.type,
				JSON.stringify(data.config ?? {}),
				data.nameContains ?? null,
				JSON.stringify(data.labelMatchers ?? [])
			);
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
				.prepare(
					`UPDATE actions
					 SET name = ?, type = ?, config = ?, name_contains = ?, label_matchers = ?, updated_at = CURRENT_TIMESTAMP
					 WHERE id = ?`
				)
				.run(
					data.name,
					data.type,
					JSON.stringify(data.config ?? {}),
					data.nameContains ?? null,
					JSON.stringify(data.labelMatchers ?? []),
					id
				);
		});
	}

	async deleteAction(id: number): Promise<void> {
		return runAsync(() => {
			this.db.prepare(`DELETE FROM actions WHERE id = ?`).run(id);
		});
	}
}
