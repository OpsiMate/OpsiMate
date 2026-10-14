import { AlertRootCause, RootCauseRating, RootCauseSource } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { runAsync } from './db';
import { TableInfoRow } from './models';
import { toIsoUtc } from '../utils/time';

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
	rating_comment: string | null;
	superseded_at: string | null;
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
	// When the alert fired again after the episode this analysis was for (null: current).
	supersededAt: string | null;
}

const toRecord = (row: RootCauseRow): RootCauseRecord => ({
	alertId: row.alert_id,
	source: row.source as RootCauseSource,
	content: row.content,
	rating: (row.rating as RootCauseRating | null) ?? null,
	ratedBy: row.rated_by,
	ratedAt: row.rated_at,
	ratingComment: row.rating_comment,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
	feedbackUpUrl: row.feedback_up_url,
	feedbackDownUrl: row.feedback_down_url,
	supersededAt: row.superseded_at,
});

// An analysis with its alert's current start (see hideAnalysesOfEndedEpisodes).
interface LegacyRootCauseRow {
	alert_id: string;
	updated_at: string;
	starts_at: string | null;
}

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
					rating_comment TEXT,
					superseded_at TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
			`);
			// Backward compatibility: the "what went wrong?" text arrived after the table.
			const columns = this.db.prepare(`PRAGMA table_info(alert_root_causes)`).all() as TableInfoRow[];
			if (!columns.some((col) => col.name === 'rating_comment')) {
				this.db.prepare(`ALTER TABLE alert_root_causes ADD COLUMN rating_comment TEXT`).run();
			}
			// Backward compatibility: hiding an earlier episode's analysis arrived later still.
			if (!columns.some((col) => col.name === 'superseded_at')) {
				this.db.prepare(`ALTER TABLE alert_root_causes ADD COLUMN superseded_at TEXT`).run();
				this.hideAnalysesOfEndedEpisodes();
			}
		});
	}

	// Replaces any previous analysis for the alert, including one hidden because it
	// belongs to an earlier episode (the new one is the current episode's, so it shows).
	// The old rating is cleared on purpose: an operator's verdict on the previous
	// content must not silently endorse (or damn) the new one.
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
						rating_comment = NULL,
						superseded_at = NULL,
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

	// A hidden (superseded) analysis is never rated: the condition is in the UPDATE itself,
	// so a re-fire committing between a caller's read and this write can't slip through.
	// The comment always follows the verdict: a re-rate without one clears the previous
	// text, so a stale "what went wrong" never outlives the thumbs-down it explained.
	async setRating(
		alertId: string,
		rating: RootCauseRating,
		ratedBy: string,
		comment: string | null
	): Promise<RootCauseRecord | null> {
		return runAsync(() => {
			const result = this.db
				.prepare(
					`UPDATE alert_root_causes SET rating = ?, rated_by = ?, rated_at = ?, rating_comment = ? WHERE alert_id = ? AND superseded_at IS NULL`
				)
				.run(rating, ratedBy, new Date().toISOString(), comment, alertId);
			if (result.changes === 0) return null;
			const row = this.db
				.prepare(`SELECT * FROM alert_root_causes WHERE alert_id = ?`)
				.get(alertId) as RootCauseRow;
			return toRecord(row);
		});
	}

	// The alerts fired again: their analyses belong to the episodes that just ended.
	async supersede(alertIds: string[]): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`UPDATE alert_root_causes SET superseded_at = ?
					 WHERE superseded_at IS NULL AND alert_id IN (SELECT value FROM json_each(?))`
				)
				.run(new Date().toISOString(), JSON.stringify(alertIds));
		});
	}

	// One-off, when the column is added: analyses stored before re-fires were tracked are
	// hidden if they were pushed before the alert's current episode started. The alert
	// tables exist on any install old enough to have analyses (a fresh one has none).
	private hideAnalysesOfEndedEpisodes(): void {
		const tables = this.db
			.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('alerts', 'alerts_resolved')`)
			.all();
		if (tables.length < 2) return;
		const rows = this.db
			.prepare(
				`SELECT r.alert_id, r.updated_at, COALESCE(a.starts_at, ar.starts_at) AS starts_at
				 FROM alert_root_causes r
				 LEFT JOIN alerts a ON a.id = r.alert_id
				 LEFT JOIN alerts_resolved ar ON ar.id = r.alert_id`
			)
			.all() as LegacyRootCauseRow[];
		const ended = rows
			.filter(
				(row) =>
					row.starts_at && new Date(row.updated_at).getTime() < new Date(toIsoUtc(row.starts_at)).getTime()
			)
			.map((row) => row.alert_id);
		if (ended.length === 0) return;
		this.db
			.prepare(
				`UPDATE alert_root_causes SET superseded_at = ? WHERE alert_id IN (SELECT value FROM json_each(?))`
			)
			.run(new Date().toISOString(), JSON.stringify(ended));
	}

	async deleteByAlertId(alertId: string): Promise<void> {
		return runAsync(() => {
			this.db.prepare(`DELETE FROM alert_root_causes WHERE alert_id = ?`).run(alertId);
		});
	}
}
