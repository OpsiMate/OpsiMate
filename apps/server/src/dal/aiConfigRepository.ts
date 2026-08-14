import Database from 'better-sqlite3';
import { runAsync } from './db';

// Singleton AI configuration row (same pattern as retention_config /
// silence_reset_config): one org-wide record, id pinned to 1. The api_key column
// stores the encryptPassword() ciphertext — never plaintext.

export interface AiConfigRow {
	provider: string;
	region: string;
	model_id: string;
	api_key: string | null;
	enabled: number;
	updated_at: string | null;
}

export class AiConfigRepository {
	constructor(private db: Database.Database) {}

	initAiConfigTable(): Promise<void> {
		return runAsync(() => {
			this.db.exec(`
				CREATE TABLE IF NOT EXISTS ai_config (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					provider TEXT NOT NULL DEFAULT 'bedrock',
					region TEXT NOT NULL DEFAULT 'us-east-1',
					model_id TEXT NOT NULL DEFAULT '',
					api_key TEXT,
					enabled INTEGER NOT NULL DEFAULT 0,
					updated_at TEXT
				);
			`);
		});
	}

	getConfig(): Promise<AiConfigRow> {
		return runAsync(() => {
			const row = this.db.prepare(`SELECT * FROM ai_config WHERE id = 1`).get() as AiConfigRow | undefined;
			if (row) return row;
			return {
				provider: 'bedrock',
				region: 'us-east-1',
				model_id: '',
				api_key: null,
				enabled: 0,
				updated_at: null,
			};
		});
	}

	// Full-row upsert: the BL merges the update over the current row first, so partial
	// updates never blank other fields.
	saveConfig(row: Omit<AiConfigRow, 'updated_at'>): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`INSERT INTO ai_config (id, provider, region, model_id, api_key, enabled, updated_at)
					 VALUES (1, ?, ?, ?, ?, ?, ?)
					 ON CONFLICT(id) DO UPDATE SET
						provider = excluded.provider,
						region = excluded.region,
						model_id = excluded.model_id,
						api_key = excluded.api_key,
						enabled = excluded.enabled,
						updated_at = excluded.updated_at`
				)
				.run(row.provider, row.region, row.model_id, row.api_key, row.enabled, new Date().toISOString());
		});
	}
}
