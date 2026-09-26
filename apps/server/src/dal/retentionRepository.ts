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
	[RetentionResource.ResolvedAlerts]: { table: 'alerts_resolved', column: 'archived_at' },
	[RetentionResource.AlertComments]: { table: 'alert_comments', column: 'created_at' },
	[RetentionResource.RootCauses]: { table: 'alert_root_causes', column: 'updated_at' },
};

// Sensible, conservative defaults. Everything starts DISABLED so upgrading never deletes data
// until an admin opts in.
const DEFAULT_POLICIES: { resource: RetentionResource; days: number }[] = [
	{ resource: RetentionResource.AuditLogs, days: 90 },
	{ resource: RetentionResource.AlertHistoryEvents, days: 90 },
	{ resource: RetentionResource.AlertStatusHistory, days: 90 },
	{ resource: RetentionResource.ActiveAlerts, days: 30 },
	{ resource: RetentionResource.ResolvedAlerts, days: 180 },
	{ resource: RetentionResource.AlertComments, days: 365 },
	{ resource: RetentionResource.RootCauses, days: 365 },
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
	vacuum_after_cleanup: number;
	last_run_at: string | null;
}

interface ColumnInfo {
	name: string;
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
					vacuum_after_cleanup INTEGER NOT NULL DEFAULT 1,
					last_run_at TEXT,
					updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
				);
				`
			);

			// Migration: add vacuum_after_cleanup to retention_config tables created before it existed.
			const cols = this.db.prepare(`PRAGMA table_info(retention_config)`).all() as ColumnInfo[];
			if (!cols.some((c) => c.name === 'vacuum_after_cleanup')) {
				this.db.exec(`ALTER TABLE retention_config ADD COLUMN vacuum_after_cleanup INTEGER NOT NULL DEFAULT 1`);
			}

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
				.prepare(
					`SELECT cleanup_interval_hours, vacuum_after_cleanup, last_run_at FROM retention_config WHERE id = 1`
				)
				.get() as ConfigRow | undefined;
			return {
				cleanupIntervalHours: row?.cleanup_interval_hours ?? DEFAULT_CLEANUP_INTERVAL_HOURS,
				vacuumAfterCleanup: row ? !!row.vacuum_after_cleanup : true,
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

	async updateConfig(updates: { cleanupIntervalHours?: number; vacuumAfterCleanup?: boolean }): Promise<void> {
		return runAsync(() => {
			const sets: string[] = [];
			const params: number[] = [];
			if (updates.cleanupIntervalHours !== undefined) {
				sets.push('cleanup_interval_hours = ?');
				params.push(updates.cleanupIntervalHours);
			}
			if (updates.vacuumAfterCleanup !== undefined) {
				sets.push('vacuum_after_cleanup = ?');
				params.push(updates.vacuumAfterCleanup ? 1 : 0);
			}
			if (sets.length === 0) return;
			sets.push("updated_at = datetime('now')");
			this.db.prepare(`UPDATE retention_config SET ${sets.join(', ')} WHERE id = 1`).run(...params);
		});
	}

	// Reclaims freed disk space: checkpoint the WAL into the main file, then VACUUM to compact it.
	// VACUUM rewrites the whole database (needs a brief write lock + temporary disk), so it runs
	// only after a cleanup that actually deleted rows.
	async vacuum(): Promise<void> {
		return runAsync(() => {
			this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
			this.db.exec('VACUUM');
		});
	}

	async setLastRunAt(iso: string): Promise<void> {
		return runAsync(() => {
			this.db.prepare(`UPDATE retention_config SET last_run_at = ? WHERE id = 1`).run(iso);
		});
	}

	// Deletes rows of the given resource older than `beforeIso`. Returns the number deleted.
	// Timestamp columns are a mix of ISO-8601 (e.g. alerts.updated_at) and SQLite's
	// "YYYY-MM-DD HH:MM:SS" (CURRENT_TIMESTAMP columns), which are not comparable as raw text.
	// Normalizing both sides with datetime() makes the age comparison correct regardless of format.
	async purgeOlderThan(resourceType: RetentionResource, beforeIso: string): Promise<number> {
		return runAsync(() => {
			const mapping = RESOURCE_TABLE[resourceType];
			if (!mapping) return 0;
			const result = this.db
				.prepare(`DELETE FROM ${mapping.table} WHERE datetime(${mapping.column}) < datetime(?)`)
				.run(beforeIso);
			return result.changes;
		});
	}
}

// --- apps/server/tests/retentionRepository.test.ts ---
if (process.env.NODE_ENV === 'test' || (typeof import.meta !== 'undefined' && (import.meta as any).vitest)) {
	const { describe, it, expect, beforeEach } = require('vitest');

	describe('RetentionRepository', () => {
		let db: Database.Database;
		let repo: RetentionRepository;

		beforeEach(() => {
			db = new Database(':memory:');
			repo = new RetentionRepository(db);
		});

		it('seeds the seven default policies, all disabled', async () => {
			await repo.initRetentionTables();
			const policies = await repo.getPolicies();
			expect(policies).toHaveLength(7);
			for (const p of policies) {
				expect(p.enabled).toBe(false);
			}
		});

		it('calling it twice keeps edits made in between (INSERT OR IGNORE, no reset)', async () => {
			await repo.initRetentionTables();
			await repo.updatePolicy(RetentionResource.AuditLogs, { enabled: true, retentionDays: 10 });
			await repo.initRetentionTables();
			const policies = await repo.getPolicies();
			const auditPolicy = policies.find((p) => p.resourceType === RetentionResource.AuditLogs);
			expect(auditPolicy?.enabled).toBe(true);
			expect(auditPolicy?.retentionDays).toBe(10);
		});

		it('rows with an unknown resource_type are dropped from the returned policies', async () => {
			await repo.initRetentionTables();
			db.exec(`INSERT INTO retention_policies (resource_type, enabled, retention_days) VALUES ('unknown_resource', 1, 5)`);
			const policies = await repo.getPolicies();
			expect(policies.find((p: any) => p.resourceType === 'unknown_resource')).toBeUndefined();
			expect(policies).toHaveLength(7);
		});

		it('getConfig() returns defaults when the config row is missing', async () => {
			await repo.initRetentionTables();
			db.exec(`DELETE FROM retention_config`);
			const config = await repo.getConfig();
			expect(config.cleanupIntervalHours).toBe(24);
			expect(config.vacuumAfterCleanup).toBe(true);
			expect(config.lastRunAt).toBeNull();
		});

		it('updatePolicy(resource, {}) and updateConfig({}) are no-ops', async () => {
			await repo.initRetentionTables();
			await repo.updatePolicy(RetentionResource.AuditLogs, {});
			await repo.updateConfig({});
			const policies = await repo.getPolicies();
			expect(policies.find((p) => p.resourceType === RetentionResource.AuditLogs)?.enabled).toBe(false);
		});

		it('purgeOlderThan deletes rows stored as ISO and as SQLite YYYY-MM-DD HH:MM:SS, and returns the count', async () => {
			await repo.initRetentionTables();
			db.exec(`CREATE TABLE audit_logs (id INTEGER PRIMARY KEY, timestamp TEXT)`);
			
			// Insert ISO format
			db.exec(`INSERT INTO audit_logs (timestamp) VALUES ('2020-01-01T00:00:00.000Z')`);
			// Insert SQLite format
			db.exec(`INSERT INTO audit_logs (timestamp) VALUES ('2020-01-02 00:00:00')`);
			// Insert newer row
			db.exec(`INSERT INTO audit_logs (timestamp) VALUES ('2026-01-01T00:00:00.000Z')`);

			const count = await repo.purgeOlderThan(RetentionResource.AuditLogs, '2025-01-01T00:00:00.000Z');
			expect(count).toBe(2);

			const remaining = db.prepare(`SELECT * FROM audit_logs`).all();
			expect(remaining).toHaveLength(1);
		});

		it('the vacuum_after_cleanup column is added when an older table lacks it', async () => {
			db.exec(`
				CREATE TABLE retention_config (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					cleanup_interval_hours INTEGER NOT NULL,
					last_run_at TEXT,
					updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
				);
			`);
			await repo.initRetentionTables();
			const cols = db.prepare(`PRAGMA table_info(retention_config)`).all() as ColumnInfo[];
			expect(cols.some((c) => c.name === 'vacuum_after_cleanup')).toBe(true);
		});
	});
}