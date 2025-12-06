import { AlertStatus, AlertType, Alert as SharedAlert } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { runAsync } from './db';
import { AlertRow, TableInfoRow } from './models';

export class AlertRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async insertOrUpdateAlert(alert: Omit<SharedAlert, 'createdAt' | 'isDismissed'>): Promise<{ changes: number }> {
		return runAsync(() => {
			const stmt = this.db.prepare(`
				INSERT INTO alerts (id, status, type, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
											  status=excluded.status,
											  type=excluded.type,
											  tags=excluded.tags,
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
				alert.type,
				JSON.stringify(alert.tags ?? {}),
				alert.startsAt,
				alert.updatedAt,
				alert.alertUrl,
				alert.alertName,
				alert.summary || null,
				alert.runbookUrl || null
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
                    tags TEXT,
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

			// Backward compatibility: ensure tags column exists
			const columns = this.db.prepare(`PRAGMA table_info(alerts)`).all();
			const hasTags = columns.some((col: TableInfoRow) => col.name === 'tags');

			if (!hasTags) {
				this.db.prepare(`ALTER TABLE alerts ADD COLUMN tags TEXT`).run();
			}
		});
	}

	private toSharedAlert = (row: AlertRow): SharedAlert => {
		const status = row.status === 'firing' ? AlertStatus.FIRING : AlertStatus.RESOLVED;

		return {
			id: row.id,
			status,
			type: row.type,
			tags: row.tags ? (JSON.parse(row.tags) as Record<string, string>) : {},
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
			this.db.prepare('UPDATE alerts SET is_dismissed = 1 WHERE id = ?').run(id);
			const row = this.db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as AlertRow | undefined;
			return row ? this.toSharedAlert(row) : null;
		});
	}

	async undismissAlert(id: string): Promise<SharedAlert | null> {
		return runAsync(() => {
			this.db.prepare('UPDATE alerts SET is_dismissed = 0 WHERE id = ?').run(id);
			const row = this.db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as AlertRow | undefined;
			return row ? this.toSharedAlert(row) : null;
		});
	}

	async getAlertsNotInIds(activeAlertIds: Set<string>, alertType: AlertType): Promise<SharedAlert[]> {
		return runAsync(() => {
			if (activeAlertIds.size === 0) {
				// No active alerts → get all alerts of this type
				const stmt = this.db.prepare(`
				SELECT * FROM alerts
				WHERE type = ?
			`);
				const dbAlerts = stmt.all(alertType) as AlertRow[];
				return dbAlerts.map(this.toSharedAlert);
			}

			// Build dynamic placeholders for SQLite
			const placeholders = Array.from(activeAlertIds)
				.map(() => '?')
				.join(',');

			const stmt = this.db.prepare(`
			SELECT * FROM alerts
			WHERE type = ?
			AND id NOT IN (${placeholders})
		`);

			const dbAlerts = stmt.all(alertType, ...activeAlertIds) as AlertRow[];
			return dbAlerts.map(this.toSharedAlert);
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
			this.db.prepare(`DELETE FROM alerts WHERE id = ?`).run(alertId);
		});
	}

	async getAlert(alertId: string) {
		return runAsync(() => {
			const row = this.db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as AlertRow | undefined;
			return row ? this.toSharedAlert(row) : null;
		});
	}
}
