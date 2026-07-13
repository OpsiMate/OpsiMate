import { AlertStatus, AlertType, normalizeAlertSeverity, Alert as SharedAlert } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { runAsync } from './db';
import { AlertRow, TableInfoRow } from './models';

export class AlertRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async insertOrUpdateAlert(alert: Omit<SharedAlert, 'createdAt' | 'isSilenced'>): Promise<{ changes: number }> {
		return runAsync(() => {
			const stmt = this.db.prepare(`
				INSERT INTO alerts (id, status, type, severity, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
											  status=excluded.status,
											  type=excluded.type,
											  severity=excluded.severity,
											  tags=excluded.tags,
											  starts_at=excluded.starts_at,
											  updated_at=excluded.updated_at,
											  alert_url=excluded.alert_url,
											  alert_name=excluded.alert_name,
											  summary=excluded.summary,
											  runbook_url=excluded.runbook_url
			`);

			// An alert id must never live in both tables: if this alert was previously
			// resolved (manually or by a source) and is now firing again, drop the resolved
			// copy — the active row is the truth. Same transaction as the upsert so a
			// failure between the two can't leave the alert in neither table.
			const upsert = this.db.transaction(() => {
				this.db.prepare(`DELETE FROM alerts_resolved WHERE id = ?`).run(alert.id);
				return stmt.run(
					alert.id,
					alert.status,
					alert.type,
					alert.severity,
					JSON.stringify(alert.tags ?? {}),
					alert.startsAt,
					alert.updatedAt,
					alert.alertUrl,
					alert.alertName,
					alert.summary || null,
					alert.runbookUrl || null
				);
			});
			return { changes: upsert().changes };
		});
	}

	// Puts a previously-resolved alert back in the active table, keeping its identity
	// (owner, silence state, created_at) and marking it unread so it surfaces as new.
	async restoreAlert(alert: SharedAlert): Promise<void> {
		return runAsync(() => {
			const restore = this.db.transaction(() => {
				// The alerts insert trigger records a "firing" status entry for every insert.
				// The alert's original firing was already recorded, and unresolve logs its own
				// UNRESOLVED event — so whatever the trigger writes for this re-insert is
				// noise. Snapshot the history high-water mark and delete past it afterwards
				// (timestamp matching won't do: legacy trigger versions stamp CURRENT_TIMESTAMP
				// while newer ones stamp starts_at).
				const { maxRowId } = this.db
					.prepare(`SELECT COALESCE(MAX(rowid), 0) AS maxRowId FROM alerts_history WHERE alert_id = ?`)
					.get(alert.id) as { maxRowId: number };

				this.db
					.prepare(
						`
						INSERT INTO alerts (id, status, type, severity, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url, is_dismissed, is_read, created_at, owner_id)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
						ON CONFLICT(id) DO UPDATE SET
													  status=excluded.status,
													  updated_at=excluded.updated_at
					`
					)
					.run(
						alert.id,
						alert.status,
						alert.type,
						alert.severity,
						JSON.stringify(alert.tags ?? {}),
						alert.startsAt,
						alert.updatedAt,
						alert.alertUrl,
						alert.alertName,
						alert.summary || null,
						alert.runbookUrl || null,
						alert.isSilenced ? 1 : 0,
						alert.createdAt,
						alert.ownerId != null ? Number(alert.ownerId) : null
					);

				this.db.prepare(`DELETE FROM alerts_history WHERE alert_id = ? AND rowid > ?`).run(alert.id, maxRowId);
			});
			restore();
		});
	}

	async initAlertsTable(): Promise<void> {
		return runAsync(() => {
			this.db.exec(`
				CREATE TABLE IF NOT EXISTS alerts (
					id TEXT PRIMARY KEY,
					status TEXT,
					severity TEXT,
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
				);
	
				CREATE TRIGGER IF NOT EXISTS archive_alert_on_insert
					AFTER INSERT ON alerts
					FOR EACH ROW
				BEGIN
					INSERT INTO alerts_history (alert_id, status, archived_at)
					VALUES (NEW.id, NEW.status, NEW.starts_at);
				END;
        	`);

			// Backward compatibility: ensure tags column exists
			const columns = this.db.prepare(`PRAGMA table_info(alerts)`).all() as TableInfoRow[];
			if (!columns.some((col: TableInfoRow) => col.name === 'is_read')) {
				this.db.prepare(`ALTER TABLE alerts ADD COLUMN is_read BOOLEAN DEFAULT 0`).run();
			}
			const hasTags = columns.some((col: TableInfoRow) => col.name === 'tags');

			if (!hasTags) {
				this.db.prepare(`ALTER TABLE alerts ADD COLUMN tags TEXT`).run();
			}

			// Backward compatibility: ensure owner_id column exists
			const hasOwnerId = columns.some((col: TableInfoRow) => col.name === 'owner_id');
			if (!hasOwnerId) {
				this.db.prepare(`ALTER TABLE alerts ADD COLUMN owner_id INTEGER REFERENCES users(id)`).run();
			}

			// Backward compatibility: ensure severity column exists
			const hasSeverity = columns.some((col: TableInfoRow) => col.name === 'severity');
			if (!hasSeverity) {
				this.db.prepare(`ALTER TABLE alerts ADD COLUMN severity TEXT`).run();
			}

			// Repair: an alert id must never exist as both active and resolved. Ingestion used
			// to re-insert a previously-resolved alert into the active table without dropping
			// its resolved copy, so it showed up twice in the UI. The active row wins — the
			// alert is firing again. Runs after initResolvedAlertsTable (see app.ts), so
			// alerts_resolved is guaranteed to exist. The users guard is for brand-new
			// databases: initUsersTable runs after this, and until the users table exists the
			// dangling owner_id FK on alerts_resolved makes any write to it fail to compile
			// ("no such table: main.users"). A fresh database has nothing to repair anyway.
			const usersTableExists = !!this.db
				.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
				.get();
			if (usersTableExists) {
				this.db.prepare(`DELETE FROM alerts_resolved WHERE id IN (SELECT id FROM alerts)`).run();
			}
		});
	}

	private toSharedAlert = (row: AlertRow): SharedAlert => {
		const status = row.status === 'firing' ? AlertStatus.FIRING : AlertStatus.RESOLVED;
		const tags = row.tags ? (JSON.parse(row.tags) as Record<string, string>) : {};

		return {
			id: row.id,
			status,
			type: row.type,
			// Legacy rows (pre-severity column) fall back to their severity tag, then the default.
			severity: normalizeAlertSeverity(row.severity ?? tags['severity']),
			tags,
			startsAt: row.starts_at,
			updatedAt: row.updated_at,
			alertUrl: row.alert_url,
			alertName: row.alert_name,
			summary: row.summary,
			runbookUrl: row.runbook_url,
			createdAt: row.created_at,
			isSilenced: row.is_dismissed ? true : false,
			isRead: row.is_read ? true : false,
			ownerId: row.owner_id != null ? String(row.owner_id) : null,
		};
	};

	async getAllAlerts(): Promise<SharedAlert[]> {
		return runAsync(() => {
			const stmt = this.db.prepare('SELECT * FROM alerts');
			const rows = stmt.all() as AlertRow[];
			return rows.map(this.toSharedAlert);
		});
	}

	async silenceAlert(id: string): Promise<SharedAlert | null> {
		return runAsync(() => {
			this.db.prepare('UPDATE alerts SET is_dismissed = 1 WHERE id = ?').run(id);
			const row = this.db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as AlertRow | undefined;
			return row ? this.toSharedAlert(row) : null;
		});
	}

	async markAlertRead(id: string): Promise<SharedAlert | null> {
		return runAsync(() => {
			this.db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(id);
			const row = this.db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as AlertRow | undefined;
			return row ? this.toSharedAlert(row) : null;
		});
	}

	async unsilenceAlert(id: string): Promise<SharedAlert | null> {
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

	async updateAlertOwner(alertId: string, ownerId: number | null): Promise<SharedAlert | null> {
		return runAsync(() => {
			this.db.prepare('UPDATE alerts SET owner_id = ? WHERE id = ?').run(ownerId, alertId);
			const row = this.db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as AlertRow | undefined;
			return row ? this.toSharedAlert(row) : null;
		});
	}
}
