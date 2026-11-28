import { describe, expect, test } from 'vitest';
import { setupDB } from './setup';
import { AlertHistoryRepository } from '../src/dal/alertHistoryRepository';

// The active table had no secondary index at all: the timed-silence sweep that runs
// before every active-list rebuild scanned it, and so did retention. These pin the
// indexes and that SQLite picks them for the exact statements the code runs.

interface IndexListRow {
	name: string;
}

interface QueryPlanRow {
	detail: string;
}

const planFor = (db: Awaited<ReturnType<typeof setupDB>>, sql: string, ...params: unknown[]): string =>
	(db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as QueryPlanRow[]).map((row) => row.detail).join(' | ');

describe('alert table indexes', () => {
	test('the indexes exist after init', async () => {
		const db = await setupDB();
		// setupDB leaves the history-events table to the app; create it the way the app does.
		await new AlertHistoryRepository(db).initAlertHistoryEventsTable();
		const names = (table: string) =>
			(db.prepare(`PRAGMA index_list(${table})`).all() as IndexListRow[]).map((index) => index.name);
		expect(names('alerts')).toEqual(expect.arrayContaining(['idx_alerts_silence_expiry', 'idx_alerts_updated_at']));
		expect(names('alerts_resolved')).toContain('idx_alerts_resolved_archived_at');
		expect(names('alerts_history')).toContain('idx_alerts_history_archived_at');
		expect(names('alert_history_events')).toContain('idx_alert_history_events_created_at');
	});

	test('the timed-silence sweep probes the expiry index', async () => {
		const db = await setupDB();
		const details = planFor(
			db,
			`SELECT id FROM alerts WHERE is_dismissed = 1 AND silenced_until IS NOT NULL AND silenced_until <= ?`,
			new Date().toISOString()
		);
		expect(details).toContain('USING INDEX idx_alerts_silence_expiry');
		expect(details).not.toContain('SCAN alerts');
	});
});
