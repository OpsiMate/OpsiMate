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
});
