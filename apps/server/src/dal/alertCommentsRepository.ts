import Database from 'better-sqlite3';
import { runAsync } from './db';
import { AlertCommentRow, ForeignKeyInfoRow } from './models.ts';
import { AlertComment } from '@OpsiMate/shared';
import { toIsoUtc } from '../utils/time';

export class AlertCommentsRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async initAlertCommentsTable(): Promise<void> {
		return runAsync(() => {
			this.db.exec(`
				CREATE TABLE IF NOT EXISTS alert_comments (
                    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                    alert_id TEXT NOT NULL,
					user_id TEXT NOT NULL,
					comment TEXT NOT NULL,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
				);

				CREATE INDEX IF NOT EXISTS idx_alert_comments_alert_id ON alert_comments(alert_id);
				CREATE INDEX IF NOT EXISTS idx_alert_comments_user_id ON alert_comments(user_id);
				CREATE INDEX IF NOT EXISTS idx_alert_comments_created_at ON alert_comments(created_at);
				-- Serves the "newest comment for THIS alert" lookup (Last Comment column) as a
				-- single backward index seek instead of a scan+sort of the alert's thread.
				CREATE INDEX IF NOT EXISTS idx_alert_comments_alert_latest ON alert_comments(alert_id, created_at);
			`);

			// Migration: the table used to declare alert_id as an FK to alerts(id) ON DELETE
			// CASCADE — but an alert id outlives its row in `alerts` (resolving moves it to
			// alerts_resolved), so resolving an alert silently wiped its whole comment
			// thread, and post-resolve comments (resolve notes) couldn't be inserted at all.
			// SQLite can't drop an FK in place; rebuild the table when the old shape exists.
			const fks = this.db.prepare(`PRAGMA foreign_key_list(alert_comments)`).all() as ForeignKeyInfoRow[];
			if (fks.some((fk) => fk.table === 'alerts')) {
				const rebuild = this.db.transaction(() => {
					this.db.exec(`
						CREATE TABLE alert_comments_new (
							id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
							alert_id TEXT NOT NULL,
							user_id TEXT NOT NULL,
							comment TEXT NOT NULL,
							created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
							updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
							FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
						);
						INSERT INTO alert_comments_new (id, alert_id, user_id, comment, created_at, updated_at)
							SELECT id, alert_id, user_id, comment, created_at, updated_at FROM alert_comments;
						DROP TABLE alert_comments;
						ALTER TABLE alert_comments_new RENAME TO alert_comments;
						CREATE INDEX IF NOT EXISTS idx_alert_comments_alert_id ON alert_comments(alert_id);
						CREATE INDEX IF NOT EXISTS idx_alert_comments_user_id ON alert_comments(user_id);
						CREATE INDEX IF NOT EXISTS idx_alert_comments_created_at ON alert_comments(created_at);
						CREATE INDEX IF NOT EXISTS idx_alert_comments_alert_latest ON alert_comments(alert_id, created_at);
					`);
				});
				rebuild();
			}
		});
	}

	private toAlertComment = (row: AlertCommentRow): AlertComment => {
		return {
			id: row.id,
			alertId: row.alert_id,
			userId: row.user_id,
			comment: row.comment,
			// CURRENT_TIMESTAMP is UTC but carries no timezone marker, so the client's
			// new Date(...) reads it as LOCAL and a fresh comment shows up hours old
			// (UTC+3 → "3h ago" the moment you post it). Normalized here, the same way
			// the alert repositories do it.
			createdAt: toIsoUtc(row.created_at),
			updatedAt: toIsoUtc(row.updated_at),
		};
	};

	async createComment(comment: Omit<AlertComment, 'createdAt' | 'updatedAt' | 'id'>): Promise<AlertComment> {
		return runAsync(() => {
			const stmt = this.db.prepare(`
                INSERT INTO alert_comments (alert_id, user_id, comment)
                VALUES (?, ?, ?)
            `);

			const result = stmt.run(comment.alertId, comment.userId, comment.comment);

			const row = this.db
				.prepare('SELECT * FROM alert_comments WHERE rowid = ?')
				.get(result.lastInsertRowid) as AlertCommentRow;

			return this.toAlertComment(row);
		});
	}

	async updateComment(id: string, userId: string, comment: string): Promise<AlertComment | null> {
		return runAsync(() => {
			const existingRow = this.db.prepare('SELECT * FROM alert_comments WHERE id = ?').get(id) as
				AlertCommentRow | undefined;

			if (!existingRow) {
				return null;
			}

			if (existingRow.user_id !== userId) {
				throw new Error('Unauthorized: User does not have permission to update this comment');
			}

			this.db
				.prepare(
					`UPDATE alert_comments 
                SET comment = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?`
				)
				.run(comment, id);

			const row = this.db.prepare('SELECT * FROM alert_comments WHERE id = ?').get(id) as AlertCommentRow;

			return this.toAlertComment(row);
		});
	}

	async deleteComment(id: string, userId: string): Promise<void> {
		return runAsync(() => {
			const existingRow = this.db.prepare('SELECT * FROM alert_comments WHERE id = ?').get(id) as
				AlertCommentRow | undefined;

			if (!existingRow) {
				return;
			}

			if (existingRow.user_id !== userId) {
				throw new Error('Unauthorized: User does not have permission to update this comment');
			}

			this.db.prepare('DELETE FROM alert_comments WHERE id = ?').run(id);
		});
	}

	async getCommentsByAlertId(alertId: string): Promise<AlertComment[]> {
		return runAsync(() => {
			const stmt = this.db.prepare(`
				SELECT * FROM alert_comments 
				WHERE alert_id = ? 
				ORDER BY created_at DESC
			`);
			const rows = stmt.all(alertId) as AlertCommentRow[];
			return rows.map(this.toAlertComment);
		});
	}

	// Newest comment text for each of the given alerts — feeds the alerts listing's
	// optional "Last Comment" column. One prepared indexed seek per listed alert
	// (idx_alert_comments_alert_latest, read backward, LIMIT 1): cost scales with the
	// number of alerts LISTED, not with every comment ever written — a global window
	// ranking over alert_comments would re-rank the whole table on every 5s poll.
	// rowid breaks created_at ties by insertion order (same-second comments).
	async getLatestCommentsByAlertIds(alertIds: string[]): Promise<Record<string, string>> {
		if (alertIds.length === 0) return {};
		return runAsync(() => {
			const stmt = this.db.prepare(
				`SELECT comment FROM alert_comments
				 WHERE alert_id = ?
				 ORDER BY created_at DESC, rowid DESC
				 LIMIT 1`
			);
			const result: Record<string, string> = {};
			for (const alertId of alertIds) {
				const row = stmt.get(alertId) as { comment: string } | undefined;
				if (row) {
					result[alertId] = row.comment;
				}
			}
			return result;
		});
	}

	async deleteCommentsByAlertId(alertId: string): Promise<void> {
		return runAsync(() => {
			this.db.prepare('DELETE FROM alert_comments WHERE alert_id = ?').run(alertId);
		});
	}
}
