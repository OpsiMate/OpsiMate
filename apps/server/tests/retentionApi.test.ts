import Database from 'better-sqlite3';
import { SuperTest, Test } from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { RetentionResource, RetentionSettings } from '@OpsiMate/shared';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

interface InvalidConfigCase {
	name: string;
	body: Record<string, unknown>;
}
interface InvalidPolicyCase extends InvalidConfigCase {
	resource: string;
}

let db: Database.Database;
let app: SuperTest<Test>;
let token: string;
const root = '/api/v1/retention';
const getSettings = () => app.get(root).set('Authorization', `Bearer ${token}`);
const put = (path: string, body: object) =>
	app.put(`${root}/${path}`).set('Authorization', `Bearer ${token}`).send(body);

beforeEach(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	token = await setupUserWithToken(app);
});
afterEach(() => db.close());

describe('retention HTTP contract', () => {
	test('returns fresh configuration and exactly one policy for every resource', async () => {
		const response = await getSettings();
		expect(response.status).toBe(200);
		expect(response.body.success).toBe(true);
		const settings = response.body.data as RetentionSettings;
		expect(settings.config).toEqual({
			cleanupIntervalHours: 24,
			vacuumAfterCleanup: true,
			lastRunAt: null,
		});
		expect(settings.policies).toHaveLength(8);
		expect(settings.policies.map((policy) => policy.resourceType).sort()).toEqual(
			Object.values(RetentionResource).sort()
		);
		for (const policy of settings.policies) {
			expect(policy.enabled).toBe(false);
			expect(policy.retentionDays).toEqual(expect.any(Number));
			expect(policy.updatedAt).toEqual(expect.any(String));
			expect(Number.isNaN(Date.parse(policy.updatedAt))).toBe(false);
		}
	});

	const invalidConfigs: InvalidConfigCase[] = [
		{ name: 'empty update', body: {} },
		{ name: 'zero interval', body: { cleanupIntervalHours: 0 } },
		{ name: 'interval above maximum', body: { cleanupIntervalHours: 721 } },
		{ name: 'fractional interval', body: { cleanupIntervalHours: 1.5 } },
		{ name: 'non-boolean vacuum flag', body: { vacuumAfterCleanup: 'true' } },
	];
	test.each(invalidConfigs)('rejects $name without changing settings', async ({ body }) => {
		const before = await getSettings();
		const response = await put('config', body);
		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({ success: false, error: 'Validation error' });
		expect(response.body.details.length).toBeGreaterThan(0);
		expect((await getSettings()).body.data).toEqual(before.body.data);
	});

	test.each([1, 720])('accepts the interval boundary %i', async (cleanupIntervalHours) => {
		const response = await put('config', { cleanupIntervalHours });
		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ success: true, data: { cleanupIntervalHours } });
		expect((await getSettings()).body.data.config.cleanupIntervalHours).toBe(cleanupIntervalHours);
	});

	test('round-trips a multi-field config update and preserves policies', async () => {
		const before = await getSettings();
		const updates = { cleanupIntervalHours: 48, vacuumAfterCleanup: true };
		const response = await put('config', updates);
		expect(response.status).toBe(200);
		expect(response.body).toEqual({ success: true, data: { ...updates, lastRunAt: null } });
		const after = await getSettings();
		expect(after.body.data.config).toEqual(response.body.data);
		expect(after.body.data.policies).toEqual(before.body.data.policies);
	});

	const invalidPolicies: InvalidPolicyCase[] = [
		{ name: 'unknown resource', resource: 'not-a-resource', body: { enabled: true } },
		{ name: 'empty policy update', resource: 'audit_logs', body: {} },
		{ name: 'zero retention days', resource: 'audit_logs', body: { retentionDays: 0 } },
		{ name: 'retention above maximum', resource: 'audit_logs', body: { retentionDays: 3651 } },
		{ name: 'fractional retention', resource: 'audit_logs', body: { retentionDays: 1.5 } },
		{ name: 'non-boolean enabled', resource: 'audit_logs', body: { enabled: 'true' } },
	];
	test.each(invalidPolicies)('rejects $name without changing policies', async ({ resource, body }) => {
		const before = await getSettings();
		const response = await put(`policies/${resource}`, body);
		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({ success: false, error: 'Validation error' });
		expect(response.body.details.length).toBeGreaterThan(0);
		expect((await getSettings()).body.data).toEqual(before.body.data);
	});

	test('updates one policy, returns it, and leaves all seven other policies untouched', async () => {
		const before = (await getSettings()).body.data as RetentionSettings;
		const response = await put('policies/audit_logs', { enabled: true, retentionDays: 7 });
		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			success: true,
			data: { resourceType: RetentionResource.AuditLogs, enabled: true, retentionDays: 7 },
		});
		expect(response.body.data.updatedAt).toEqual(expect.any(String));
		const after = (await getSettings()).body.data as RetentionSettings;
		expect(after.policies.find((policy) => policy.resourceType === RetentionResource.AuditLogs)).toEqual(
			response.body.data
		);
		const otherPolicies = (settings: RetentionSettings) =>
			settings.policies.filter((policy) => policy.resourceType !== RetentionResource.AuditLogs);
		expect(otherPolicies(after)).toHaveLength(7);
		expect(otherPolicies(after)).toEqual(otherPolicies(before));
		expect(after.config).toEqual(before.config);
	});

	test('runs disabled policies without deletions or vacuum and persists the run timestamp', async () => {
		expect((await getSettings()).body.data.config.lastRunAt).toBeNull();
		const started = Date.now();
		const response = await app.post(`${root}/run`).set('Authorization', `Bearer ${token}`);
		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			success: true,
			data: { ranAt: expect.any(String), deleted: {}, vacuumed: false },
		});
		const ranAt = response.body.data.ranAt as string;
		expect(new Date(ranAt).toISOString()).toBe(ranAt);
		expect(Date.parse(ranAt)).toBeGreaterThanOrEqual(started);
		expect(Date.parse(ranAt)).toBeLessThanOrEqual(Date.now());
		expect((await getSettings()).body.data.config.lastRunAt).toBe(ranAt);
	});
});
