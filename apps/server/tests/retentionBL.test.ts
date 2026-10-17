import { afterEach, describe, expect, test, vi } from 'vitest';
import { RetentionConfig, RetentionPolicy, RetentionResource } from '@OpsiMate/shared';
import { RetentionBL } from '../src/bl/retention/retention.bl';
import { RetentionRepository } from '../src/dal/retentionRepository';
import { MS_PER_DAY, MS_PER_HOUR } from '../src/utils/time';

// RetentionBL.runCleanup / isCleanupDue are pure orchestration over the repository: which
// policies to purge, what cutoff, when to VACUUM, and recording the run time. These tests run
// the BL directly with a stubbed repository — no database, no HTTP — and fake timers so the
// cutoff maths is exact.

// A fixed "now" so cutoff/elapsed assertions don't drift with the wall clock.
const NOW = new Date('2026-10-17T12:00:00.000Z');

const config = (overrides: Partial<RetentionConfig> = {}): RetentionConfig => ({
	cleanupIntervalHours: 24,
	vacuumAfterCleanup: false,
	lastRunAt: null,
	...overrides,
});

const policy = (overrides: Partial<RetentionPolicy> & { resourceType: RetentionResource }): RetentionPolicy => ({
	enabled: true,
	retentionDays: 30,
	updatedAt: NOW.toISOString(),
	...overrides,
});

// A repository stub whose getPolicies/getConfig return the supplied values and whose write
// methods are spies. purgeOlderThan resolves to a per-resource count by default; individual
// tests override any method to throw.
function stubRepo(options: {
	policies?: RetentionPolicy[];
	config?: RetentionConfig;
	purge?: RetentionRepository['purgeOlderThan'];
	vacuum?: RetentionRepository['vacuum'];
}) {
	const repo = {
		getPolicies: vi.fn().mockResolvedValue(options.policies ?? []),
		getConfig: vi.fn().mockResolvedValue(options.config ?? config()),
		purgeOlderThan: options.purge ?? vi.fn().mockResolvedValue(0),
		vacuum: options.vacuum ?? vi.fn().mockResolvedValue(undefined),
		setLastRunAt: vi.fn().mockResolvedValue(undefined),
	};
	return { repo, bl: new RetentionBL(repo as unknown as RetentionRepository) };
}

afterEach(() => {
	vi.useRealTimers();
});

describe('RetentionBL.isCleanupDue', () => {
	test('is due when the job has never run (lastRunAt is null)', async () => {
		const { bl } = stubRepo({ config: config({ lastRunAt: null }) });
		await expect(bl.isCleanupDue()).resolves.toBe(true);
	});

	test('is not due when the last run was more recent than the interval', async () => {
		vi.useFakeTimers({ now: NOW });
		const lastRunAt = new Date(NOW.getTime() - 1 * MS_PER_HOUR).toISOString();
		const { bl } = stubRepo({ config: config({ cleanupIntervalHours: 24, lastRunAt }) });

		await expect(bl.isCleanupDue()).resolves.toBe(false);
	});

	test('is due exactly at the interval boundary (elapsed >= interval)', async () => {
		vi.useFakeTimers({ now: NOW });
		const lastRunAt = new Date(NOW.getTime() - 24 * MS_PER_HOUR).toISOString();
		const { bl } = stubRepo({ config: config({ cleanupIntervalHours: 24, lastRunAt }) });

		await expect(bl.isCleanupDue()).resolves.toBe(true);
	});

	test('is due when the last run is older than the interval', async () => {
		vi.useFakeTimers({ now: NOW });
		const lastRunAt = new Date(NOW.getTime() - 48 * MS_PER_HOUR).toISOString();
		const { bl } = stubRepo({ config: config({ cleanupIntervalHours: 24, lastRunAt }) });

		await expect(bl.isCleanupDue()).resolves.toBe(true);
	});
});

describe('RetentionBL.runCleanup', () => {
	test('skips disabled policies: purgeOlderThan is never called for them', async () => {
		vi.useFakeTimers({ now: NOW });
		const { repo, bl } = stubRepo({
			policies: [policy({ resourceType: RetentionResource.AuditLogs, enabled: false })],
		});

		const result = await bl.runCleanup();

		expect(repo.purgeOlderThan).not.toHaveBeenCalled();
		expect(result.deleted).toEqual({});
	});

	test('purges each enabled policy with a cutoff of now minus its retentionDays', async () => {
		vi.useFakeTimers({ now: NOW });
		const purge = vi.fn().mockResolvedValue(0);
		const { bl } = stubRepo({
			policies: [
				policy({ resourceType: RetentionResource.AuditLogs, retentionDays: 30 }),
				policy({ resourceType: RetentionResource.AlertComments, retentionDays: 7 }),
			],
			purge,
		});

		await bl.runCleanup();

		expect(purge).toHaveBeenCalledWith(
			RetentionResource.AuditLogs,
			new Date(NOW.getTime() - 30 * MS_PER_DAY).toISOString()
		);
		expect(purge).toHaveBeenCalledWith(
			RetentionResource.AlertComments,
			new Date(NOW.getTime() - 7 * MS_PER_DAY).toISOString()
		);
	});

	test('reports the deletion count per resource in the result', async () => {
		vi.useFakeTimers({ now: NOW });
		const purge = vi.fn((resource: RetentionResource) =>
			Promise.resolve(resource === RetentionResource.AuditLogs ? 5 : 2)
		);
		const { bl } = stubRepo({
			policies: [
				policy({ resourceType: RetentionResource.AuditLogs }),
				policy({ resourceType: RetentionResource.AlertComments }),
			],
			purge,
		});

		const result = await bl.runCleanup();

		expect(result.deleted).toEqual({
			[RetentionResource.AuditLogs]: 5,
			[RetentionResource.AlertComments]: 2,
		});
	});

	test('a failure on one resource does not abort the others, and the failed one is omitted', async () => {
		vi.useFakeTimers({ now: NOW });
		const purge = vi.fn((resource: RetentionResource) =>
			resource === RetentionResource.AuditLogs ? Promise.reject(new Error('db locked')) : Promise.resolve(3)
		);
		const { repo, bl } = stubRepo({
			policies: [
				policy({ resourceType: RetentionResource.AuditLogs }),
				policy({ resourceType: RetentionResource.AlertComments }),
			],
			purge,
		});

		const result = await bl.runCleanup();

		expect(purge).toHaveBeenCalledTimes(2);
		expect(result.deleted).toEqual({ [RetentionResource.AlertComments]: 3 });
		expect(result.deleted).not.toHaveProperty(RetentionResource.AuditLogs);
		// The run still finishes and records its time.
		expect(repo.setLastRunAt).toHaveBeenCalledTimes(1);
	});

	test('VACUUMs only when the flag is set AND rows were deleted', async () => {
		vi.useFakeTimers({ now: NOW });

		// (1) flag on, rows deleted -> vacuum
		const deleted = stubRepo({
			policies: [policy({ resourceType: RetentionResource.AuditLogs })],
			config: config({ vacuumAfterCleanup: true }),
			purge: vi.fn().mockResolvedValue(4),
		});
		const r1 = await deleted.bl.runCleanup();
		expect(deleted.repo.vacuum).toHaveBeenCalledTimes(1);
		expect(r1.vacuumed).toBe(true);

		// (2) flag on, nothing deleted -> no vacuum
		const nothing = stubRepo({
			policies: [policy({ resourceType: RetentionResource.AuditLogs })],
			config: config({ vacuumAfterCleanup: true }),
			purge: vi.fn().mockResolvedValue(0),
		});
		const r2 = await nothing.bl.runCleanup();
		expect(nothing.repo.vacuum).not.toHaveBeenCalled();
		expect(r2.vacuumed).toBe(false);

		// (3) flag off, rows deleted -> no vacuum
		const flagOff = stubRepo({
			policies: [policy({ resourceType: RetentionResource.AuditLogs })],
			config: config({ vacuumAfterCleanup: false }),
			purge: vi.fn().mockResolvedValue(4),
		});
		const r3 = await flagOff.bl.runCleanup();
		expect(flagOff.repo.vacuum).not.toHaveBeenCalled();
		expect(r3.vacuumed).toBe(false);
	});

	test('a failed VACUUM is caught and reported as vacuumed: false', async () => {
		vi.useFakeTimers({ now: NOW });
		const { repo, bl } = stubRepo({
			policies: [policy({ resourceType: RetentionResource.AuditLogs })],
			config: config({ vacuumAfterCleanup: true }),
			purge: vi.fn().mockResolvedValue(4),
			vacuum: vi.fn().mockRejectedValue(new Error('cannot VACUUM within a transaction')),
		});

		const result = await bl.runCleanup();

		expect(repo.vacuum).toHaveBeenCalledTimes(1);
		expect(result.vacuumed).toBe(false);
	});

	test('records the run time once, with the ISO timestamp returned in the result, even after a purge failure', async () => {
		vi.useFakeTimers({ now: NOW });
		const { repo, bl } = stubRepo({
			policies: [policy({ resourceType: RetentionResource.AuditLogs })],
			purge: vi.fn().mockRejectedValue(new Error('boom')),
		});

		const result = await bl.runCleanup();

		expect(repo.setLastRunAt).toHaveBeenCalledTimes(1);
		expect(repo.setLastRunAt).toHaveBeenCalledWith(NOW.toISOString());
		expect(result.ranAt).toBe(NOW.toISOString());
	});
});
