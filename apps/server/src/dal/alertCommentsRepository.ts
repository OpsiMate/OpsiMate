import Database from 'better-sqlite3';
import { runAsync } from './db';
import { AlertCommentRow, ForeignKeyInfoRow } from './models.ts';
import { AlertComment } from '@OpsiMate/shared';

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
			createdAt: row.created_at,
			updatedAt: row.updated_at,
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

	async deleteCommentsByAlertId(alertId: string): Promise<void> {
		return runAsync(() => {
			this.db.prepare('DELETE FROM alert_comments WHERE alert_id = ?').run(alertId);
		});
	}
}
