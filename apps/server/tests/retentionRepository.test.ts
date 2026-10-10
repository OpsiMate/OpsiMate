import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { RetentionResource } from '@OpsiMate/shared';
import { RetentionRepository } from '../src/dal/retentionRepository';

let db: Database.Database;
let repository: RetentionRepository;

beforeEach(() => {
	db = new Database(':memory:');
	repository = new RetentionRepository(db);
});

afterEach(() => {
	db.close();
});

describe('RetentionRepository', () => {
	test('initializes default retention policies and config', async () => {
		await repository.initRetentionTables();

		const policies = await repository.getPolicies();
		const config = await repository.getConfig();

		expect(policies).toHaveLength(8);

		expect(policies).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					resourceType: RetentionResource.AuditLogs,
					enabled: false,
					retentionDays: 90,
				}),
				expect.objectContaining({
					resourceType: RetentionResource.ActiveAlerts,
					enabled: false,
					retentionDays: 30,
				}),
				expect.objectContaining({
					resourceType: RetentionResource.ResolvedAlerts,
					enabled: false,
					retentionDays: 180,
				}),
			])
		);

		expect(config.cleanupIntervalHours).toBe(24);
		expect(config.vacuumAfterCleanup).toBe(true);
		expect(config.lastRunAt).toBeNull();
	});

	test('updates a retention policy', async () => {
		await repository.initRetentionTables();

		await repository.updatePolicy(RetentionResource.AuditLogs, {
			enabled: true,
			retentionDays: 30,
		});

		const policies = await repository.getPolicies();
		const policy = policies.find((p) => p.resourceType === RetentionResource.AuditLogs);

		expect(policy).toEqual(
			expect.objectContaining({
				resourceType: RetentionResource.AuditLogs,
				enabled: true,
				retentionDays: 30,
			})
		);
	});

	test('updates retention configuration', async () => {
		await repository.initRetentionTables();

		await repository.updateConfig({
			cleanupIntervalHours: 12,
			vacuumAfterCleanup: false,
		});

		const config = await repository.getConfig();

		expect(config.cleanupIntervalHours).toBe(12);
		expect(config.vacuumAfterCleanup).toBe(false);
	});

	test('updates the last run timestamp', async () => {
		await repository.initRetentionTables();

		const timestamp = '2026-10-08T10:00:00.000Z';

		await repository.setLastRunAt(timestamp);

		const config = await repository.getConfig();

		expect(config.lastRunAt).toBe(timestamp);
	});

	test('purges records older than the specified date', async () => {
		await repository.initRetentionTables();

		db.exec(`
            CREATE TABLE audit_logs (
                id INTEGER PRIMARY KEY,
                timestamp TEXT NOT NULL
            )
        `);

		db.prepare(`INSERT INTO audit_logs (id, timestamp) VALUES (?, ?)`).run(1, '2024-01-01T00:00:00.000Z');

		db.prepare(`INSERT INTO audit_logs (id, timestamp) VALUES (?, ?)`).run(2, '2026-01-01T00:00:00.000Z');

		const deleted = await repository.purgeOlderThan(RetentionResource.AuditLogs, '2025-01-01T00:00:00.000Z');

		expect(deleted).toBe(1);

		const remaining = db.prepare('SELECT * FROM audit_logs').all();

		expect(remaining).toHaveLength(1);
		expect(remaining[0]).toEqual(
			expect.objectContaining({
				id: 2,
			})
		);
	});

	test('returns 0 when purging an unsupported resource', async () => {
		await repository.initRetentionTables();

		const deleted = await repository.purgeOlderThan(
			'unsupported-resource' as RetentionResource,
			'2025-01-01T00:00:00.000Z'
		);

		expect(deleted).toBe(0);
	});

	test('does not duplicate policies when initialized more than once', async () => {
		await repository.initRetentionTables();

		await repository.updatePolicy(RetentionResource.AuditLogs, {
			enabled: true,
			retentionDays: 30,
		});

		await repository.initRetentionTables();

		const policies = await repository.getPolicies();
		const auditLogsPolicy = policies.find((p) => p.resourceType === RetentionResource.AuditLogs);

		expect(policies).toHaveLength(8);
		expect(auditLogsPolicy).toEqual(
			expect.objectContaining({
				enabled: true,
				retentionDays: 30,
			})
		);
	});

	test('drops rows with unknown resource_type from getPolicies', async () => {
		await repository.initRetentionTables();

		db.prepare(
			`
            INSERT INTO retention_policies (resource_type, enabled, retention_days)
            VALUES (?, ?, ?)
        `
		).run('invalid_unknown_resource', 1, 45);

		const policies = await repository.getPolicies();
		const unknownPolicy = policies.find(
			(p) => (p.resourceType as unknown as string) === 'invalid_unknown_resource'
		);

		expect(unknownPolicy).toBeUndefined();
		expect(policies).toHaveLength(8);
	});

	test('getConfig returns defaults when the config row is missing', async () => {
		await repository.initRetentionTables();

		db.prepare('DELETE FROM retention_config').run();

		const config = await repository.getConfig();

		expect(config.cleanupIntervalHours).toBe(24);
		expect(config.vacuumAfterCleanup).toBe(true);
		expect(config.lastRunAt).toBeNull();
	});

	test('updatePolicy and updateConfig with empty updates are no-ops', async () => {
		await repository.initRetentionTables();

		const initialConfig = await repository.getConfig();
		const initialPolicies = await repository.getPolicies();

		await repository.updateConfig({});
		await repository.updatePolicy(RetentionResource.AuditLogs, {});

		const currentConfig = await repository.getConfig();
		const currentPolicies = await repository.getPolicies();

		expect(currentConfig).toEqual(initialConfig);
		expect(currentPolicies).toEqual(initialPolicies);
	});

	test('purges rows stored in SQLite YYYY-MM-DD HH:MM:SS format and returns count', async () => {
		await repository.initRetentionTables();

		db.exec(`
            CREATE TABLE audit_logs (
                id INTEGER PRIMARY KEY,
                timestamp TEXT NOT NULL
            )
        `);

		db.prepare(`INSERT INTO audit_logs (id, timestamp) VALUES (?, ?)`).run(1, '2024-01-01 12:00:00');
		db.prepare(`INSERT INTO audit_logs (id, timestamp) VALUES (?, ?)`).run(2, '2026-06-01 12:00:00');

		const deleted = await repository.purgeOlderThan(RetentionResource.AuditLogs, '2025-01-01T00:00:00.000Z');

		expect(deleted).toBe(1);

		const remaining = db.prepare('SELECT * FROM audit_logs').all();
		expect(remaining).toHaveLength(1);
		expect(remaining[0]).toEqual(expect.objectContaining({ id: 2 }));
	});

	test('adds vacuum_after_cleanup column when an older table lacks it', async () => {
		db.exec(`
            CREATE TABLE retention_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                cleanup_interval_hours INTEGER NOT NULL DEFAULT 24,
                last_run_at TEXT DEFAULT NULL
            );
        `);

		await repository.initRetentionTables();

		const tableInfo = db.prepare(`PRAGMA table_info(retention_config)`).all() as { name: string }[];

		const hasVacuumCol = tableInfo.some((col) => col.name === 'vacuum_after_cleanup');
		expect(hasVacuumCol).toBe(true);

		const config = await repository.getConfig();
		expect(config.vacuumAfterCleanup).toBe(true);
	});
});
