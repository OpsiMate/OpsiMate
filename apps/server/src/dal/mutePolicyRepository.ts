import Database from 'better-sqlite3';
import { MutePolicy, MutePolicyLabelMatcher, MutePolicySchedule } from '@OpsiMate/shared';
import { runAsync } from './db';

interface MutePolicyRow {
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

export type CreateMutePolicyInput = Omit<MutePolicy, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateMutePolicyInput = Partial<Omit<MutePolicy, 'id' | 'createdAt' | 'updatedAt'>>;

export class MutePolicyRepository {
	constructor(private db: Database.Database) {}

	private toShared = (row: MutePolicyRow): MutePolicy => {
		let labelMatchers: MutePolicyLabelMatcher[] = [];
		if (row.label_matchers) {
			try {
				const parsed: unknown = JSON.parse(row.label_matchers);
				if (Array.isArray(parsed)) labelMatchers = parsed as MutePolicyLabelMatcher[];
			} catch {
				labelMatchers = [];
			}
		}
		let schedule: MutePolicySchedule | null = null;
		if (row.schedule) {
			try {
				const parsed: unknown = JSON.parse(row.schedule);
				if (
					parsed &&
					typeof parsed === 'object' &&
					Array.isArray((parsed as { daysOfWeek?: unknown }).daysOfWeek) &&
					typeof (parsed as { startTime?: unknown }).startTime === 'string' &&
					typeof (parsed as { endTime?: unknown }).endTime === 'string'
				) {
					schedule = parsed as MutePolicySchedule;
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

	async initMutePoliciesTable(): Promise<void> {
		return runAsync(() => {
			// Migration: the feature used to be called "silences"; carry existing rows over.
			// Only rename when the legacy table exists AND the new one does not yet — a
			// rollback then re-upgrade can leave both present, and RENAME would throw.
			const tableExists = (name: string): boolean =>
				!!this.db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name);
			if (tableExists('alert_silences') && !tableExists('alert_mute_policies')) {
				this.db.prepare(`ALTER TABLE alert_silences RENAME TO alert_mute_policies`).run();
			}

			this.db
				.prepare(
					`
					CREATE TABLE IF NOT EXISTS alert_mute_policies (
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

			const columns = this.db.prepare(`PRAGMA table_info(alert_mute_policies)`).all() as { name: string }[];
			if (!columns.some((c) => c.name === 'schedule')) {
				this.db.prepare(`ALTER TABLE alert_mute_policies ADD COLUMN schedule TEXT`).run();
			}
		});
	}

	async createMutePolicy(data: CreateMutePolicyInput): Promise<{ lastID: number }> {
		return runAsync(() => {
			const stmt = this.db.prepare(
				`INSERT INTO alert_mute_policies (name, name_contains, label_matchers, starts_at, ends_at, schedule, reason)
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

	async getAllMutePolicies(): Promise<MutePolicy[]> {
		return runAsync(() => {
			const rows = this.db
				.prepare(`SELECT * FROM alert_mute_policies ORDER BY created_at DESC`)
				.all() as MutePolicyRow[];
			return rows.map(this.toShared);
		});
	}

	async getMutePolicyById(id: number): Promise<MutePolicy | undefined> {
		return runAsync(() => {
			const row = this.db.prepare(`SELECT * FROM alert_mute_policies WHERE id = ?`).get(id) as
				| MutePolicyRow
				| undefined;
			return row ? this.toShared(row) : undefined;
		});
	}

	async updateMutePolicy(id: number, data: UpdateMutePolicyInput): Promise<void> {
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
			this.db.prepare(`UPDATE alert_mute_policies SET ${updates.join(', ')} WHERE id = ?`).run(...values);
		});
	}

	async deleteMutePolicy(id: number): Promise<void> {
		return runAsync(() => {
			this.db.prepare(`DELETE FROM alert_mute_policies WHERE id = ?`).run(id);
		});
	}
}
