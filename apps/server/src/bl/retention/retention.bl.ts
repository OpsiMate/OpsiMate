import {
	Logger,
	RetentionConfig,
	RetentionPolicy,
	RetentionResource,
	RetentionRunResult,
	RetentionSettings,
} from '@OpsiMate/shared';
import { RetentionRepository } from '../../dal/retentionRepository';

const logger = new Logger('bl/retention.bl');

export class RetentionBL {
	constructor(private retentionRepo: RetentionRepository) {}

	async getSettings(): Promise<RetentionSettings> {
		const [config, policies] = await Promise.all([
			this.retentionRepo.getConfig(),
			this.retentionRepo.getPolicies(),
		]);
		return { config, policies };
	}

	async updatePolicy(
		resourceType: RetentionResource,
		updates: { enabled?: boolean; retentionDays?: number }
	): Promise<RetentionPolicy> {
		await this.retentionRepo.updatePolicy(resourceType, updates);
		const policies = await this.retentionRepo.getPolicies();
		const updated = policies.find((p) => p.resourceType === resourceType);
		if (!updated) {
			throw new Error(`Unknown retention resource: ${resourceType}`);
		}
		return updated;
	}

	async updateConfig(cleanupIntervalHours: number): Promise<RetentionConfig> {
		await this.retentionRepo.updateConfig(cleanupIntervalHours);
		return this.retentionRepo.getConfig();
	}

	// Runs every enabled policy: deletes rows older than its retention window. Resilient — a
	// failure on one resource is logged and does not abort the others. Records last-run time.
	async runCleanup(): Promise<RetentionRunResult> {
		const policies = await this.retentionRepo.getPolicies();
		const ranAt = new Date().toISOString();
		const deleted: Partial<Record<RetentionResource, number>> = {};

		for (const policy of policies) {
			if (!policy.enabled) continue;
			const cutoff = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000).toISOString();
			try {
				const count = await this.retentionRepo.purgeOlderThan(policy.resourceType, cutoff);
				deleted[policy.resourceType] = count;
				if (count > 0) {
					logger.info(
						`Retention: deleted ${count} ${policy.resourceType} rows older than ${policy.retentionDays}d`
					);
				}
			} catch (error) {
				logger.error(`Retention: failed to purge ${policy.resourceType}`, error);
			}
		}

		await this.retentionRepo.setLastRunAt(ranAt);
		return { ranAt, deleted };
	}

	// Whether a scheduled run is due, based on the configured interval and the last run time.
	async isCleanupDue(): Promise<boolean> {
		const config = await this.retentionRepo.getConfig();
		if (!config.lastRunAt) return true;
		const elapsedMs = Date.now() - new Date(config.lastRunAt).getTime();
		return elapsedMs >= config.cleanupIntervalHours * 60 * 60 * 1000;
	}
}
