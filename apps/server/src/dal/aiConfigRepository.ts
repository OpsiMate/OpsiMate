import Database from 'better-sqlite3';
import { runAsync } from './db';

// Singleton AI configuration row (same pattern as retention_config /
// silence_reset_config): one org-wide record, id pinned to 1. The api_key column
// stores the encryptPassword() ciphertext — never plaintext.

export interface AiConfigRow {
	provider: string;
	region: string;
	model_id: string;
	base_url: string;
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
					base_url TEXT NOT NULL DEFAULT '',
					api_key TEXT,
					enabled INTEGER NOT NULL DEFAULT 0,
					updated_at TEXT
				);
			`);
			// Migration: add base_url column for existing databases.
			const cols = this.db.pragma('table_info(ai_config)') as Array<{ name: string }>;
			if (!cols.some((c) => c.name === 'base_url')) {
				this.db.exec(`ALTER TABLE ai_config ADD COLUMN base_url TEXT NOT NULL DEFAULT ''`);
			}
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

	// Read-merge-write in ONE transaction. Two requests sending different partial
	// updates would otherwise both read the same row and the second full-row upsert
	// would silently discard the first's field — so the merge callback runs INSIDE
	// the transaction and sees the committed row. better-sqlite3 transactions are
	// synchronous, so the callback must be too; anything it throws (a validation
	// failure, say) rolls the transaction back and leaves the stored config untouched.
	mergeConfig(merge: (current: AiConfigRow) => Omit<AiConfigRow, 'updated_at'>): Promise<AiConfigRow> {
		return runAsync(() => {
			const run = this.db.transaction(() => {
				const current = (this.db.prepare(`SELECT * FROM ai_config WHERE id = 1`).get() as
					AiConfigRow | undefined) ?? {
					provider: 'bedrock',
					region: 'us-east-1',
					model_id: '',
					base_url: '',
					api_key: null,
					enabled: 0,
					updated_at: null,
				};
				const next = merge(current);
				const updatedAt = new Date().toISOString();
				this.db
					.prepare(
						`INSERT INTO ai_config (id, provider, region, model_id, base_url, api_key, enabled, updated_at)
						 VALUES (1, ?, ?, ?, ?, ?, ?, ?)
						 ON CONFLICT(id) DO UPDATE SET
							provider = excluded.provider,
							region = excluded.region,
							model_id = excluded.model_id,
							base_url = excluded.base_url,
							api_key = excluded.api_key,
							enabled = excluded.enabled,
							updated_at = excluded.updated_at`
					)
					.run(next.provider, next.region, next.model_id, next.base_url, next.api_key, next.enabled, updatedAt);
				return { ...next, updated_at: updatedAt };
			});
			return run();
		});
	}
}
