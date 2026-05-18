import Database from 'better-sqlite3';
import { AlertSilence, AlertSilenceLabelMatcher, AlertSilenceSchedule } from '@OpsiMate/shared';
import { runAsync } from './db';

interface SilenceRow {
	id: number;
	name: string;
	name_contains: string | null;
	label_matchers: string | null;
	starts_at: string | null;
	ends_at: string | null;
	schedule: string | null;
	reason: string | null;
	created_at: string;
	updated_at: string;
}

export type CreateSilenceInput = Omit<AlertSilence, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateSilenceInput = Partial<Omit<AlertSilence, 'id' | 'createdAt' | 'updatedAt'>>;

export class SilenceRepository {
	constructor(private db: Database.Database) {}

	private toShared = (row: SilenceRow): AlertSilence => {
		let labelMatchers: AlertSilenceLabelMatcher[] = [];
		if (row.label_matchers) {
			try {
				const parsed = JSON.parse(row.label_matchers);
				if (Array.isArray(parsed)) labelMatchers = parsed;
			} catch {
				labelMatchers = [];
			}
		}
		let schedule: AlertSilenceSchedule | null = null;
		if (row.schedule) {
			try {
				const parsed = JSON.parse(row.schedule);
				if (parsed && Array.isArray(parsed.daysOfWeek) && parsed.startTime && parsed.endTime) {
					schedule = parsed as AlertSilenceSchedule;
				}
			} catch {
				schedule = null;
			}
		}
		return {
			id: row.id,
			name: row.name,
			nameContains: row.name_contains,
			labelMatchers,
			startsAt: row.starts_at,
			endsAt: row.ends_at,
			schedule,
			reason: row.reason,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	};

	async initSilencesTable(): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`
					CREATE TABLE IF NOT EXISTS alert_silences (
						id              INTEGER PRIMARY KEY AUTOINCREMENT,
						name            TEXT NOT NULL,
						name_contains   TEXT,
						label_matchers  TEXT,
						starts_at       DATETIME,
						ends_at         DATETIME,
						schedule        TEXT,
						reason          TEXT,
						created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
					)
				`
				)
				.run();

			const columns = this.db
				.prepare(`PRAGMA table_info(alert_silences)`)
				.all() as { name: string }[];
			if (!columns.some((c) => c.name === 'schedule')) {
				this.db.prepare(`ALTER TABLE alert_silences ADD COLUMN schedule TEXT`).run();
			}
		});
	}

	async createSilence(data: CreateSilenceInput): Promise<{ lastID: number }> {
		return runAsync(() => {
			const stmt = this.db.prepare(
				`INSERT INTO alert_silences (name, name_contains, label_matchers, starts_at, ends_at, schedule, reason)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			);
			const result = stmt.run(
				data.name,
				data.nameContains ?? null,
				JSON.stringify(data.labelMatchers ?? []),
				data.startsAt ?? null,
				data.endsAt ?? null,
				data.schedule ? JSON.stringify(data.schedule) : null,
				data.reason ?? null
			);
			return { lastID: result.lastInsertRowid as number };
		});
	}

	async getAllSilences(): Promise<AlertSilence[]> {
		return runAsync(() => {
			const rows = this.db
				.prepare(`SELECT * FROM alert_silences ORDER BY created_at DESC`)
				.all() as SilenceRow[];
			return rows.map(this.toShared);
		});
	}

	async getSilenceById(id: number): Promise<AlertSilence | undefined> {
		return runAsync(() => {
			const row = this.db.prepare(`SELECT * FROM alert_silences WHERE id = ?`).get(id) as
				| SilenceRow
				| undefined;
			return row ? this.toShared(row) : undefined;
		});
	}

	async updateSilence(id: number, data: UpdateSilenceInput): Promise<void> {
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
			if (data.startsAt !== undefined) {
				updates.push('starts_at = ?');
				values.push(data.startsAt);
			}
			if (data.endsAt !== undefined) {
				updates.push('ends_at = ?');
				values.push(data.endsAt);
			}
			if (data.schedule !== undefined) {
				updates.push('schedule = ?');
				values.push(data.schedule ? JSON.stringify(data.schedule) : null);
			}
			if (data.reason !== undefined) {
				updates.push('reason = ?');
				values.push(data.reason);
			}

			if (updates.length === 0) return;

			updates.push('updated_at = CURRENT_TIMESTAMP');
			values.push(id);
			this.db
				.prepare(`UPDATE alert_silences SET ${updates.join(', ')} WHERE id = ?`)
				.run(...values);
		});
	}

	async deleteSilence(id: number): Promise<void> {
		return runAsync(() => {
			this.db.prepare(`DELETE FROM alert_silences WHERE id = ?`).run(id);
		});
	}
}
