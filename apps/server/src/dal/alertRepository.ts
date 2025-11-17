import Database from 'better-sqlite3';
import { runAsync } from './db';
import { AlertRow } from './models';
import { Alert as SharedAlert, AlertType } from '@OpsiMate/shared';

export class AlertRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async insertOrUpdateAlert(alert: Omit<AlertRow, 'created_at' | 'is_dismissed'>): Promise<{ changes: number }> {
		return runAsync(() => {
			const stmt = this.db.prepare(`
                INSERT INTO alerts (id, status, tag, type, starts_at, updated_at, alert_url, alert_name, summary, runbook_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status=excluded.status,
                    tag=excluded.tag,
                    type=excluded.type,
                    starts_at=excluded.starts_at,
                    updated_at=excluded.updated_at,
                    alert_url=excluded.alert_url,
                    alert_name=excluded.alert_name,
                    summary=excluded.summary,
                    runbook_url=excluded.runbook_url
            `);
			const result = stmt.run(
				alert.id,
				alert.status,
				alert.tag,
				alert.type,
				alert.starts_at,
				alert.updated_at,
				alert.alert_url,
				alert.alert_name,
				alert.summary || null,
				alert.runbook_url || null
			);
			return { changes: result.changes };
		});
	}

	async initAlertsTable(): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`
                CREATE TABLE IF NOT EXISTS alerts (
                    id TEXT PRIMARY KEY,
                    status TEXT,
                    tag TEXT,
					type TEXT,
                    starts_at TEXT,
                    updated_at TEXT,
                    alert_url TEXT,
                    alert_name TEXT,
                    is_dismissed BOOLEAN DEFAULT 0,
                    summary TEXT,
                    runbook_url TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
				)
				.run();
		});
	}

	private toSharedAlert = (row: AlertRow): SharedAlert => {
		return {
			id: row.id,
			status: row.status,
			tag: row.tag,
			type: row.type,
			startsAt: row.starts_at,
			updatedAt: row.updated_at,
			alertUrl: row.alert_url,
			alertName: row.alert_name,
			summary: row.summary,
			runbookUrl: row.runbook_url,
			createdAt: row.created_at,
			isDismissed: row.is_dismissed ? true : false,
		};
	};

	async getAllAlerts(): Promise<SharedAlert[]> {
		return runAsync(() => {
			const stmt = this.db.prepare('SELECT * FROM alerts');
			const rows = stmt.all() as AlertRow[];
			return rows.map(this.toSharedAlert);
		});
	}

	async dismissAlert(id: string): Promise<SharedAlert | null> {
		return runAsync(() => {
			const updateStmt = this.db.prepare('UPDATE alerts SET is_dismissed = 1 WHERE id = ?');
			updateStmt.run(id);
			const selectStmt = this.db.prepare('SELECT * FROM alerts WHERE id = ?');
			const row = selectStmt.get(id) as AlertRow | undefined;
			return row ? this.toSharedAlert(row) : null;
		});
	}

	async undismissAlert(id: string): Promise<SharedAlert | null> {
		return runAsync(() => {
			const updateStmt = this.db.prepare('UPDATE alerts SET is_dismissed = 0 WHERE id = ?');
			updateStmt.run(id);
			const selectStmt = this.db.prepare('SELECT * FROM alerts WHERE id = ?');
			const row = selectStmt.get(id) as AlertRow | undefined;
			return row ? this.toSharedAlert(row) : null;
		});
	}

	async deleteAlertsNotInIds(activeAlertIds: Set<string>, alertType: AlertType) {
		return runAsync(() => {
			if (activeAlertIds.size === 0) {
				// No active alerts → delete all alerts of this type
				const stmt = this.db.prepare(`
				DELETE FROM alerts
				WHERE type = ?
			`);
				stmt.run(alertType);
				return;
			}

			// Build dynamic placeholders for SQLite
			const placeholders = Array.from(activeAlertIds)
				.map(() => '?')
				.join(',');

			const stmt = this.db.prepare(`
			DELETE FROM alerts
			WHERE type = ?
			AND id NOT IN (${placeholders})
		`);

			stmt.run(alertType, ...activeAlertIds);
		});
	}

	async deleteAlert(alertId: string) {
		return runAsync(() => {
			const stmt = this.db.prepare(`DELETE FROM alerts WHERE id = ?`);
			stmt.run(alertId);
		});
	}
}
