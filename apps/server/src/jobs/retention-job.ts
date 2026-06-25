/* eslint-disable @typescript-eslint/no-misused-promises */
import { Logger } from '@OpsiMate/shared';
import { RetentionBL } from '../bl/retention/retention.bl';

const logger = new Logger('retention-job');

// How often the job wakes to check whether a cleanup is due. The actual cadence between runs is
// the admin-configured cleanupIntervalHours; this short tick just lets config changes take effect
// without a restart (the worker re-reads the interval from the DB each tick).
const TICK_MS = 10 * 60 * 1000; // 10 minutes

export class RetentionJob {
	constructor(private retentionBL: RetentionBL) {}

	startRetentionJob = () => {
		logger.info('[Job] Starting data-retention cleanup job');

		// Check once on startup, then on every tick.
		this.tick().catch((err) => logger.error('[Job] Initial retention run failed:', err));

		setInterval(async () => {
			await this.tick();
		}, TICK_MS);
	};

	private tick = async () => {
		try {
			if (await this.retentionBL.isCleanupDue()) {
				const result = await this.retentionBL.runCleanup();
				const total = Object.values(result.deleted).reduce((a, b) => a + (b ?? 0), 0);
				logger.info(`[Job] Retention cleanup complete — ${total} rows deleted`);
			}
		} catch (err) {
			logger.error('[Job] Retention tick failed:', err);
		}
	};
}
