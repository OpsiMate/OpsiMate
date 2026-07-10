import { AlertHistoryEventType } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { runAsync } from './db';

export interface AlertHistoryEventRow {
	id: number;
	alert_id: string;
	event_type: string;
	actor_name: string | null;
	description: string | null;
	created_at: string;
}

export interface RecordAlertEventInput {
	alertId: string;
	eventType: AlertHistoryEventType;
	actorName?: string | null;
	description?: string | null;
}

// Stores user-driven events in an alert's life (ownership changes, silencings, actions run,
// comments). Status transitions stay in the trigger-populated `alerts_history` table; the
// history endpoint merges both sources. Rows are small and written only on explicit mutations,
// so this table grows slowly relative to alert ingestion.
export class AlertHistoryRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async initAlertHistoryEventsTable(): Promise<void> {
		return runAsync(() => {
			this.db.exec(
				`
				CREATE TABLE IF NOT EXISTS alert_history_events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					alert_id TEXT NOT NULL,
					event_type TEXT NOT NULL,
					actor_name TEXT,
					description TEXT,
					created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
				);

				CREATE INDEX IF NOT EXISTS idx_alert_history_events_alert
					ON alert_history_events (alert_id, created_at);
				`
			);
		});
	}

	async recordEvent(input: RecordAlertEventInput): Promise<void> {
		return runAsync(() => {
			// Write an explicit ISO-8601 UTC timestamp rather than relying on SQLite's
			// CURRENT_TIMESTAMP (which is "YYYY-MM-DD HH:MM:SS", no timezone). The client parses
			// these with new Date(...); without the UTC marker that would be read as local time,
			// breaking both display and the history time-range filter.
			this.db
				.prepare(
					`INSERT INTO alert_history_events (alert_id, event_type, actor_name, description, created_at)
					 VALUES (?, ?, ?, ?, ?)`
				)
				.run(
					input.alertId,
					input.eventType,
					input.actorName ?? null,
					input.description ?? null,
					new Date().toISOString()
				);
		});
	}

	async getEvents(alertId: string): Promise<AlertHistoryEventRow[]> {
		return runAsync(() => {
			return this.db
				.prepare(
					`SELECT id, alert_id, event_type, actor_name, description, created_at
					 FROM alert_history_events
					 WHERE alert_id = ?
					 ORDER BY created_at DESC`
				)
				.all(alertId) as AlertHistoryEventRow[];
		});
	}
}
