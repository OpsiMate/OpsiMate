import { AlertStatus, Alert as SharedAlert, AlertHistory } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { runAsync } from './db';
import { ArchivedAlertRow, TableInfoRow } from './models';

export class ArchivedAlertRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async initArchivedAlertsTable(): Promise<void> {
		return runAsync(() => {
			this.db.exec(
				`
						CREATE TABLE IF NOT EXISTS alerts_archived (
																	   id TEXT PRIMARY KEY,
																	   status TEXT NOT NULL,
																	   tags TEXT,
																	   type TEXT,
																	   starts_at TEXT,
																	   updated_at TEXT,
																	   alert_url TEXT,
																	   alert_name TEXT,
																	   is_dismissed BOOLEAN DEFAULT 0,
																	   summary TEXT,
																	   runbook_url TEXT,
																	   created_at TEXT,
																	   archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
						);

						CREATE TABLE IF NOT EXISTS alerts_history (
																	  history_id INTEGER PRIMARY KEY AUTOINCREMENT,
																	  alert_id TEXT NOT NULL,
																	  archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
																	  status TEXT NOT NULL
						);

						CREATE TRIGGER IF NOT EXISTS archive_alert_history_on_update
							BEFORE UPDATE ON alerts_archived
							FOR EACH ROW
						BEGIN
							INSERT INTO alerts_history (alert_id, status)
							VALUES (OLD.id, OLD.status);
						END;

						CREATE TRIGGER IF NOT EXISTS archive_alert_history_on_insert
							AFTER INSERT ON alerts_archived
							FOR EACH ROW
						BEGIN
							INSERT INTO alerts_history (alert_id, status)
							VALUES (NEW.id, NEW.status);
						END;
						`
			);

			// Backward compatibility: ensure tags column exists
			const columns = this.db.prepare(`PRAGMA table_info(alerts_archived)`).all() as TableInfoRow[];
			const hasTags = columns.some((col: TableInfoRow) => col.name === 'tags');

			if (!hasTags) {
				this.db.prepare(`ALTER TABLE alerts_archived ADD COLUMN tags TEXT`).run();
			}

			// Backward compatibility: ensure owner_id column exists
			const hasOwnerId = columns.some((col: TableInfoRow) => col.name === 'owner_id');
			if (!hasOwnerId) {
				this.db.prepare(`ALTER TABLE alerts_archived ADD COLUMN owner_id INTEGER REFERENCES users(id)`).run();
			}
		});
	}

	async insertArchivedAlert(alert: SharedAlert): Promise<{ changes: number }> {
		return runAsync(() => {
			const stmt = this.db.prepare(`
                INSERT INTO alerts_archived
                    (id, status, tags, type, starts_at, updated_at, alert_url, alert_name, is_dismissed, summary, runbook_url, created_at, owner_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status = excluded.status,
                    tags = excluded.tags,
                    type = excluded.type,
                    starts_at = excluded.starts_at,
                    updated_at = excluded.updated_at,
                    alert_url = excluded.alert_url,
                    alert_name = excluded.alert_name,
                    is_dismissed = excluded.is_dismissed,
                    summary = excluded.summary,
                    runbook_url = excluded.runbook_url,
                    created_at = excluded.created_at,
                    owner_id = excluded.owner_id,
                    archived_at = CURRENT_TIMESTAMP
            `);

			const result = stmt.run(
				alert.id,
				AlertStatus.RESOLVED,
				JSON.stringify(alert.tags),
				alert.type,
				alert.startsAt,
				alert.updatedAt,
				alert.alertUrl,
				alert.alertName,
				alert.isDismissed ? 1 : 0,
				alert.summary || null,
				alert.runbookUrl || null,
				alert.createdAt,
				alert.ownerId != null ? Number(alert.ownerId) : null
			);

			return { changes: result.changes };
		});
	}

	private toSharedAlert = (row: ArchivedAlertRow): SharedAlert => {
		return {
			id: row.id,
			status: row.status == 'firing' ? AlertStatus.FIRING : AlertStatus.RESOLVED,
			tags: row.tags ? (JSON.parse(row.tags) as Record<string, string>) : {},
			type: row.type,
			startsAt: row.starts_at,
			updatedAt: row.updated_at,
			alertUrl: row.alert_url,
			alertName: row.alert_name,
			summary: row.summary,
			runbookUrl: row.runbook_url,
			createdAt: row.created_at,
			isDismissed: row.is_dismissed ? true : false,
			ownerId: row.owner_id != null ? String(row.owner_id) : null,
		};
	};

	async getAllArchivedAlerts(): Promise<SharedAlert[]> {
		return runAsync(() => {
			const stmt = this.db.prepare('SELECT * FROM alerts_archived ORDER BY archived_at DESC');
			const rows = stmt.all() as ArchivedAlertRow[];
			return rows.map(this.toSharedAlert);
		});
	}

	async deleteArchivedAlert(alertId: string): Promise<void> {
		return runAsync(() => {
			const stmt = this.db.prepare(`DELETE FROM alerts_archived WHERE id = ?`);
			stmt.run(alertId);
		});
	}

	async getAlertHistory(alertId: string): Promise<AlertHistory> {
		const history: { archived_at: string; status: string }[] = await runAsync(() => {
			return this.db
				.prepare(
					`
					SELECT
						archived_at,
						status
					FROM alerts_history
					WHERE alert_id = ?
					ORDER BY archived_at ASC
				`
				)
				.all(alertId) as { archived_at: string; status: string }[];
		});

		return {
			alertId,
			data: history.map((h) => ({
				date: h.archived_at,
				status: h.status as AlertStatus,
			})),
		};
	}
}
