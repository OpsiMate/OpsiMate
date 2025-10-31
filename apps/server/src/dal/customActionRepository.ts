import Database from 'better-sqlite3';
import { runAsync } from './db';
import { CustomAction } from '@OpsiMate/custom-actions';

type CustomActionRow = {
	id: number;
	name: string;
	description: string;
	type: 'bash' | 'http';
	target: 'service' | 'provider' | null;
	script: string | null;
	http_config: string | null;
	created_at: string;
};

export class CustomActionRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async initCustomActionsTable(): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`
					CREATE TABLE IF NOT EXISTS custom_actions (
					    id INTEGER PRIMARY KEY AUTOINCREMENT,
					    name TEXT NOT NULL,
					    description TEXT NOT NULL,
					    type TEXT NOT NULL,
					    target TEXT,
					    script TEXT,
					    http_config TEXT,
					    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
					)
					`
				)
				.run();
		});
	}

	async create(data: CustomAction): Promise<{ lastID: number }> {
		return runAsync(() => {
			if (data.type !== 'bash') {
				throw new Error('Unsupported action type');
			}
			const { script } = this.toStorageFields(data);
			const stmt = this.db.prepare(
				'INSERT INTO custom_actions (name, description, type, target, script, http_config) VALUES (?, ?, ?, ?, ?, ?)' 
			);
			const res = stmt.run(data.name, data.description, data.type, data.target, script, null);
			return { lastID: res.lastInsertRowid as number };
		});
	}

	async list(): Promise<CustomAction[]> {
		return runAsync(() => {
			const stmt = this.db.prepare(
				`SELECT id, name, description, type, target, script, http_config, created_at FROM custom_actions ORDER BY created_at DESC`
			);
			const rows = stmt.all() as CustomActionRow[];
			return rows.map((r) => this.fromRow(r));
		});
	}

	async getById(id: number): Promise<CustomAction | undefined> {
		return runAsync(() => {
			const stmt = this.db.prepare(
				`SELECT id, name, description, type, target, script, http_config, created_at FROM custom_actions WHERE id = ?`
			);
			const row = stmt.get(id) as CustomActionRow | undefined;
			return row ? this.fromRow(row) : undefined;
		});
	}

	async update(id: number, data: CustomAction): Promise<void> {
		return runAsync(() => {
			if (data.type !== 'bash') {
				throw new Error('Unsupported action type');
			}
			const { script } = this.toStorageFields(data);
			const stmt = this.db.prepare(
				`UPDATE custom_actions SET name = ?, description = ?, type = ?, target = ?, script = ?, http_config = ? WHERE id = ?`
			);
			stmt.run(data.name, data.description, data.type, data.target, script, null, id);
		});
	}

	private fromRow(row: CustomActionRow): CustomAction {
		if (row.type === 'bash') {
			return {
				name: row.name,
				description: row.description,
				type: 'bash',
				target: row.target,
				script: row.script,
			};
		}
		const cfg = row.http_config ? (JSON.parse(row.http_config) as { url: string; method: 'GET'|'POST'|'PUT'|'DELETE'|'PATCH'; headers?: Record<string,string>; body?: string }) : { url: '', method: 'GET' as const };
		return {
			name: row.name,
			description: row.description,
			type: 'http',
			target: row.target,
			url: cfg.url,
			method: cfg.method,
			headers: cfg.headers || null,
			body: cfg.body || null,
		};
	}

	private toStorageFields(action: CustomAction): { script: string | null; httpConfig: string | null } {
		if (action.type === 'bash') {
			return { script: action.script ?? null, httpConfig: null };
		}
		const httpConfig = JSON.stringify({ url: action.url, method: action.method, headers: action.headers || undefined, body: action.body || undefined });
		return { script: null, httpConfig };
	}

	async delete(id: number): Promise<void> {
		return runAsync(() => {
			const stmt = this.db.prepare(`DELETE FROM custom_actions WHERE id = ?`);
			stmt.run(id);
		});
	}
}


