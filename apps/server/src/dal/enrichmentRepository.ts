import Database from 'better-sqlite3';
import { AlertEnrichment, AlertEnrichmentField, AlertSilenceLabelMatcher } from '@OpsiMate/shared';
import { runAsync } from './db';

interface EnrichmentRow {
	id: number;
	name: string;
	name_contains: string | null;
	label_matchers: string | null;
	add_fields: string | null;
	summary_template: string | null;
	priority: number | null;
	created_by: string | null;
	last_modified_by: string | null;
	created_at: string;
	updated_at: string;
}

export type CreateEnrichmentInput = Omit<AlertEnrichment, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEnrichmentInput = Partial<Omit<AlertEnrichment, 'id' | 'createdAt' | 'updatedAt'>>;

const parseJsonArray = <T>(raw: string | null): T[] => {
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as T[]) : [];
	} catch {
		return [];
	}
};

export class EnrichmentRepository {
	constructor(private db: Database.Database) {}

	private toShared = (row: EnrichmentRow): AlertEnrichment => ({
		id: row.id,
		name: row.name,
		nameContains: row.name_contains,
		labelMatchers: parseJsonArray<AlertSilenceLabelMatcher>(row.label_matchers),
		addFields: parseJsonArray<AlertEnrichmentField>(row.add_fields),
		summaryTemplate: row.summary_template,
		priority: row.priority ?? 0,
		createdBy: row.created_by,
		lastModifiedBy: row.last_modified_by,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	});

	async initEnrichmentsTable(): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`
					CREATE TABLE IF NOT EXISTS alert_enrichments (
						id               INTEGER PRIMARY KEY AUTOINCREMENT,
						name             TEXT NOT NULL,
						name_contains    TEXT,
						label_matchers   TEXT,
						add_fields       TEXT,
						summary_template TEXT,
						priority         INTEGER DEFAULT 0,
						created_by       TEXT,
						last_modified_by TEXT,
						created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
					)
				`
				)
				.run();

			// Migrate older installs that predate later columns.
			const columns = this.db.prepare(`PRAGMA table_info(alert_enrichments)`).all() as { name: string }[];
			const hasColumn = (name: string) => columns.some((c) => c.name === name);
			if (!hasColumn('priority')) {
				this.db.prepare(`ALTER TABLE alert_enrichments ADD COLUMN priority INTEGER DEFAULT 0`).run();
			}
			if (!hasColumn('created_by')) {
				this.db.prepare(`ALTER TABLE alert_enrichments ADD COLUMN created_by TEXT`).run();
			}
			if (!hasColumn('last_modified_by')) {
				this.db.prepare(`ALTER TABLE alert_enrichments ADD COLUMN last_modified_by TEXT`).run();
			}
		});
	}

	async createEnrichment(data: CreateEnrichmentInput, actor?: string | null): Promise<{ lastID: number }> {
		return runAsync(() => {
			const stmt = this.db.prepare(
				`INSERT INTO alert_enrichments (name, name_contains, label_matchers, add_fields, summary_template, priority, created_by, last_modified_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			);
			const result = stmt.run(
				data.name,
				data.nameContains ?? null,
				JSON.stringify(data.labelMatchers ?? []),
				JSON.stringify(data.addFields ?? []),
				data.summaryTemplate ?? null,
				data.priority ?? 0,
				actor ?? null,
				actor ?? null
			);
			return { lastID: result.lastInsertRowid as number };
		});
	}

	async getAllEnrichments(): Promise<AlertEnrichment[]> {
		return runAsync(() => {
			const rows = this.db
				.prepare(`SELECT * FROM alert_enrichments ORDER BY created_at DESC`)
				.all() as EnrichmentRow[];
			return rows.map(this.toShared);
		});
	}

	async getEnrichmentById(id: number): Promise<AlertEnrichment | undefined> {
		return runAsync(() => {
			const row = this.db.prepare(`SELECT * FROM alert_enrichments WHERE id = ?`).get(id) as
				| EnrichmentRow
				| undefined;
			return row ? this.toShared(row) : undefined;
		});
	}

	async updateEnrichment(id: number, data: UpdateEnrichmentInput, actor?: string | null): Promise<void> {
		return runAsync(() => {
			const updates: string[] = [];
			const values: unknown[] = [];

			if (data.name !== undefined) {
				updates.push('name = ?');
				values.push(data.name);
			}
			if (data.nameContains !== undefined) {
				updates.push('name_contains = ?');
				values.push(data.nameContains);
			}
			if (data.labelMatchers !== undefined) {
				updates.push('label_matchers = ?');
				values.push(JSON.stringify(data.labelMatchers));
			}
			if (data.addFields !== undefined) {
				updates.push('add_fields = ?');
				values.push(JSON.stringify(data.addFields));
			}
			if (data.summaryTemplate !== undefined) {
				updates.push('summary_template = ?');
				values.push(data.summaryTemplate);
			}
			if (data.priority !== undefined) {
				updates.push('priority = ?');
				values.push(data.priority);
			}

			if (updates.length === 0) return; // nothing changed

			// Stamp who last modified it, but never erase an existing value when the
			// request has no user context (e.g. API-token auth).
			if (actor != null) {
				updates.push('last_modified_by = ?');
				values.push(actor);
			}

			updates.push('updated_at = CURRENT_TIMESTAMP');
			values.push(id);
			this.db.prepare(`UPDATE alert_enrichments SET ${updates.join(', ')} WHERE id = ?`).run(...values);
		});
	}

	async deleteEnrichment(id: number): Promise<void> {
		return runAsync(() => {
			this.db.prepare(`DELETE FROM alert_enrichments WHERE id = ?`).run(id);
		});
	}
}
