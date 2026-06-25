import { RetentionConfig, RetentionPolicy, RetentionResource } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { runAsync } from './db';

// Safe, server-controlled mapping from a retention resource key to the physical table and the
// timestamp column used to decide a row's age. Table/column names come only from this whitelist
// (never from request input), so the dynamic DELETE below cannot be injected.
const RESOURCE_TABLE: Record<RetentionResource, { table: string; column: string }> = {
	[RetentionResource.AuditLogs]: { table: 'audit_logs', column: 'timestamp' },
	[RetentionResource.AlertHistoryEvents]: { table: 'alert_history_events', column: 'created_at' },
	[RetentionResource.AlertStatusHistory]: { table: 'alerts_history', column: 'archived_at' },
	[RetentionResource.ActiveAlerts]: { table: 'alerts', column: 'updated_at' },
	[RetentionResource.ArchivedAlerts]: { table: 'alerts_archived', column: 'archived_at' },
	[RetentionResource.AlertComments]: { table: 'alert_comments', column: 'created_at' },
};

// Sensible, conservative defaults. Everything starts DISABLED so upgrading never deletes data
// until an admin opts in.
const DEFAULT_POLICIES: { resource: RetentionResource; days: number }[] = [
	{ resource: RetentionResource.AuditLogs, days: 90 },
	{ resource: RetentionResource.AlertHistoryEvents, days: 90 },
	{ resource: RetentionResource.AlertStatusHistory, days: 90 },
	{ resource: RetentionResource.ActiveAlerts, days: 30 },
	{ resource: RetentionResource.ArchivedAlerts, days: 180 },
	{ resource: RetentionResource.AlertComments, days: 365 },
];

const DEFAULT_CLEANUP_INTERVAL_HOURS = 24;

interface PolicyRow {
	resource_type: string;
	enabled: number;
	retention_days: number;
	updated_at: string;
}

interface ConfigRow {
	cleanup_interval_hours: number;
	last_run_at: string | null;
}

export class RetentionRepository {
	constructor(private db: Database.Database) {}

	async initRetentionTables(): Promise<void> {
		return runAsync(() => {
			this.db.exec(
				`
				CREATE TABLE IF NOT EXISTS retention_policies (
					resource_type TEXT PRIMARY KEY,
					enabled INTEGER NOT NULL DEFAULT 0,
					retention_days INTEGER NOT NULL,
					updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
				);

				CREATE TABLE IF NOT EXISTS retention_config (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					cleanup_interval_hours INTEGER NOT NULL,
					last_run_at TEXT,
					updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
				);
				`
			);

			// Seed defaults (idempotent — only inserts missing rows).
			const insertPolicy = this.db.prepare(
				`INSERT OR IGNORE INTO retention_policies (resource_type, enabled, retention_days)
				 VALUES (?, 0, ?)`
			);
			for (const p of DEFAULT_POLICIES) {
				insertPolicy.run(p.resource, p.days);
			}
			this.db
				.prepare(
					`INSERT OR IGNORE INTO retention_config (id, cleanup_interval_hours, last_run_at)
					 VALUES (1, ?, NULL)`
				)
				.run(DEFAULT_CLEANUP_INTERVAL_HOURS);
		});
	}

	async getPolicies(): Promise<RetentionPolicy[]> {
		return runAsync(() => {
			const rows = this.db
				.prepare(`SELECT resource_type, enabled, retention_days, updated_at FROM retention_policies`)
				.all() as PolicyRow[];
			// Only surface known resources (defends against stale keys).
			return rows
				.filter((r) => (Object.values(RetentionResource) as string[]).includes(r.resource_type))
				.map((r) => ({
					resourceType: r.resource_type as RetentionResource,
					enabled: !!r.enabled,
					retentionDays: r.retention_days,
					updatedAt: r.updated_at,
				}));
		});
	}

	async getConfig(): Promise<RetentionConfig> {
		return runAsync(() => {
			const row = this.db
				.prepare(`SELECT cleanup_interval_hours, last_run_at FROM retention_config WHERE id = 1`)
				.get() as ConfigRow | undefined;
			return {
				cleanupIntervalHours: row?.cleanup_interval_hours ?? DEFAULT_CLEANUP_INTERVAL_HOURS,
				lastRunAt: row?.last_run_at ?? null,
			};
		});
	}

	async updatePolicy(
		resourceType: RetentionResource,
		updates: { enabled?: boolean; retentionDays?: number }
	): Promise<void> {
		return runAsync(() => {
			const sets: string[] = [];
			const params: (number | string)[] = [];
			if (updates.enabled !== undefined) {
				sets.push('enabled = ?');
				params.push(updates.enabled ? 1 : 0);
			}
			if (updates.retentionDays !== undefined) {
				sets.push('retention_days = ?');
				params.push(updates.retentionDays);
			}
			if (sets.length === 0) return;
			sets.push("updated_at = datetime('now')");
			params.push(resourceType);
			this.db.prepare(`UPDATE retention_policies SET ${sets.join(', ')} WHERE resource_type = ?`).run(...params);
		});
	}

	async updateConfig(cleanupIntervalHours: number): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`UPDATE retention_config SET cleanup_interval_hours = ?, updated_at = datetime('now') WHERE id = 1`
				)
				.run(cleanupIntervalHours);
		});
	}

	async setLastRunAt(iso: string): Promise<void> {
		return runAsync(() => {
			this.db.prepare(`UPDATE retention_config SET last_run_at = ? WHERE id = 1`).run(iso);
		});
	}

	// Deletes rows of the given resource older than `beforeIso`. Returns the number deleted.
	async purgeOlderThan(resourceType: RetentionResource, beforeIso: string): Promise<number> {
		return runAsync(() => {
			const mapping = RESOURCE_TABLE[resourceType];
			if (!mapping) return 0;
			const result = this.db.prepare(`DELETE FROM ${mapping.table} WHERE ${mapping.column} < ?`).run(beforeIso);
			return result.changes;
		});
	}
}
