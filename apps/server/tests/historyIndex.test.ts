import { describe, expect, test } from 'vitest';
import { setupDB } from './setup';

// alerts_history is probed by alert_id on every active-snapshot recompute
// (getFiringTimesByAlert) and on every history-drawer open (getAlertHistory). Both
// were full table scans before idx_alerts_history_alert existed, which made main-page
// cost grow with TOTAL history size — these tests pin the index and, more importantly,
// that SQLite actually chooses it for both hot queries. An index that exists but goes
// unused (say, after a query rewrite wraps the column in a function) fails here too.

interface IndexListRow {
	name: string;
}

interface QueryPlanRow {
	detail: string;
}

describe('alerts_history index', () => {
	test('idx_alerts_history_alert exists after init', async () => {
		const db = await setupDB();
		const indexes = db.prepare(`PRAGMA index_list(alerts_history)`).all() as IndexListRow[];
		expect(indexes.map((index) => index.name)).toContain('idx_alerts_history_alert');
	});

	test('the firing-times probe and the drawer read both use it', async () => {
		const db = await setupDB();
		const firingPlan = db
			.prepare(
				`EXPLAIN QUERY PLAN
				 SELECT alert_id, archived_at FROM alerts_history
				 WHERE status = 'firing' AND alert_id IN (?, ?)`
			)
			.all('a', 'b') as QueryPlanRow[];
		const drawerPlan = db
			.prepare(
				`EXPLAIN QUERY PLAN
				 SELECT archived_at, status FROM alerts_history
				 WHERE alert_id = ? ORDER BY archived_at DESC`
			)
			.all('a') as QueryPlanRow[];

		for (const plan of [firingPlan, drawerPlan]) {
			const details = plan.map((row) => row.detail).join(' | ');
			expect(details).toContain('USING INDEX idx_alerts_history_alert');
			expect(details).not.toContain('SCAN alerts_history');
		}
	});
});
