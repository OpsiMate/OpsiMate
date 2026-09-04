import { AlertRootCause, RootCauseRating, RootCauseSource } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { runAsync } from './db';

// One row per alert (UNIQUE(alert_id) — which is also the index every read probes by,
// so lookups stay O(log n) however large this grows; see #897 for why that matters).
// Deliberately its OWN table, never joined into the alerts snapshot: content can be
// kilobytes per alert and is only ever read when an operator opens one alert's drawer.
//
// Timestamps are explicit ISO-8601 UTC written by the app, never SQLite's bare
// CURRENT_TIMESTAMP — mixed formats in one column is what forced the datetime()
// wrapper (and defeated indexes) elsewhere.
interface RootCauseRow {
	alert_id: string;
	source: string;
	content: string;
	feedback_up_url: string | null;
	feedback_down_url: string | null;
	rating: string | null;
	rated_by: string | null;
	rated_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface UpsertRootCauseInput {
	alertId: string;
	source: RootCauseSource;
	content: string;
	feedbackUpUrl: string | null;
	feedbackDownUrl: string | null;
}

// The server-only half: callback URLs stay in the DAL/BL and are never serialized
// into AlertRootCause (they may embed sender tokens).
export interface RootCauseRecord extends AlertRootCause {
	feedbackUpUrl: string | null;
	feedbackDownUrl: string | null;
}

const toRecord = (row: RootCauseRow): RootCauseRecord => ({
	alertId: row.alert_id,
	source: row.source as RootCauseSource,
	content: row.content,
	rating: (row.rating as RootCauseRating | null) ?? null,
	ratedBy: row.rated_by,
	ratedAt: row.rated_at,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
	feedbackUpUrl: row.feedback_up_url,
	feedbackDownUrl: row.feedback_down_url,
});

export class RootCauseRepository {
	constructor(private db: Database.Database) {}

	async initRootCausesTable(): Promise<void> {
		return runAsync(() => {
			this.db.exec(`
				CREATE TABLE IF NOT EXISTS alert_root_causes (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					alert_id TEXT NOT NULL UNIQUE,
					source TEXT NOT NULL,
					content TEXT NOT NULL,
					feedback_up_url TEXT,
					feedback_down_url TEXT,
					rating TEXT,
					rated_by TEXT,
					rated_at TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
			`);
		});
	}

	// Replaces any previous analysis for the alert. The old rating is cleared on
	// purpose: an operator's verdict on the previous content must not silently
	// endorse (or damn) the new one.
	async upsert(input: UpsertRootCauseInput): Promise<RootCauseRecord> {
		return runAsync(() => {
			const now = new Date().toISOString();
			this.db
				.prepare(
					`INSERT INTO alert_root_causes
						(alert_id, source, content, feedback_up_url, feedback_down_url, rating, rated_by, rated_at, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
					 ON CONFLICT(alert_id) DO UPDATE SET
						source = excluded.source,
						content = excluded.content,
						feedback_up_url = excluded.feedback_up_url,
						feedback_down_url = excluded.feedback_down_url,
						rating = NULL,
						rated_by = NULL,
						rated_at = NULL,
						updated_at = excluded.updated_at`
				)
				.run(input.alertId, input.source, input.content, input.feedbackUpUrl, input.feedbackDownUrl, now, now);
			const row = this.db
				.prepare(`SELECT * FROM alert_root_causes WHERE alert_id = ?`)
				.get(input.alertId) as RootCauseRow;
			return toRecord(row);
		});
	}

	async getByAlertId(alertId: string): Promise<RootCauseRecord | null> {
		return runAsync(() => {
			const row = this.db.prepare(`SELECT * FROM alert_root_causes WHERE alert_id = ?`).get(alertId) as
				RootCauseRow | undefined;
			return row ? toRecord(row) : null;
		});
	}

	async setRating(alertId: string, rating: RootCauseRating, ratedBy: string): Promise<RootCauseRecord | null> {
		return runAsync(() => {
			const result = this.db
				.prepare(`UPDATE alert_root_causes SET rating = ?, rated_by = ?, rated_at = ? WHERE alert_id = ?`)
				.run(rating, ratedBy, new Date().toISOString(), alertId);
			if (result.changes === 0) return null;
			const row = this.db
				.prepare(`SELECT * FROM alert_root_causes WHERE alert_id = ?`)
				.get(alertId) as RootCauseRow;
			return toRecord(row);
		});
	}

	async deleteByAlertId(alertId: string): Promise<void> {
		return runAsync(() => {
			this.db.prepare(`DELETE FROM alert_root_causes WHERE alert_id = ?`).run(alertId);
		});
	}
}
