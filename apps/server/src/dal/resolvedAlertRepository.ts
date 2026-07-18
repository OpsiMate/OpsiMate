import { AlertStatus, Alert as SharedAlert, AlertHistory, normalizeAlertSeverity } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { runAsync } from './db';
import { ResolvedAlertRow, TableInfoRow } from './models';

export class ResolvedAlertRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async initResolvedAlertsTable(): Promise<void> {
		return runAsync(() => {
			// Migration: this store used to be called "archived"; carry existing rows over.
			// Only rename when the legacy table exists AND the new one does not yet, so a
			// rollback then re-upgrade (both present) can't crash on the RENAME.
			const tableExists = (name: string): boolean =>
				!!this.db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name);
			if (tableExists('alerts_archived') && !tableExists('alerts_resolved')) {
				this.db.prepare(`ALTER TABLE alerts_archived RENAME TO alerts_resolved`).run();
			}

			// The rename can leave the status-history triggers attached to the old table name,
			// where they never fire (and CREATE TRIGGER IF NOT EXISTS below won't replace them,
			// because the trigger *names* still exist). Drop the stale ones so they're recreated
			// on alerts_resolved.
			const staleTriggers = this.db
				.prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'alerts_archived'`)
				.all() as { name: string }[];
			for (const trigger of staleTriggers) {
				this.db.prepare(`DROP TRIGGER IF EXISTS "${trigger.name}"`).run();
			}

			this.db.exec(
				`
						CREATE TABLE IF NOT EXISTS alerts_resolved (
																	   id TEXT PRIMARY KEY,
																	   status TEXT NOT NULL,
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
							BEFORE UPDATE ON alerts_resolved
							FOR EACH ROW
						BEGIN
							INSERT INTO alerts_history (alert_id, status)
							VALUES (OLD.id, OLD.status);
						END;

						CREATE TRIGGER IF NOT EXISTS archive_alert_history_on_insert
							AFTER INSERT ON alerts_resolved
							FOR EACH ROW
						BEGIN
							INSERT INTO alerts_history (alert_id, status)
							VALUES (NEW.id, NEW.status);
						END;
						`
			);

			// Backfill: rows resolved while the triggers were stale never got their 'resolved'
			// status-history entry. Add one (stamped with the resolve time) where it's missing.
			this.db
				.prepare(
					`
					INSERT INTO alerts_history (alert_id, status, archived_at)
					SELECT r.id, 'resolved', r.archived_at
					FROM alerts_resolved r
					WHERE NOT EXISTS (
						SELECT 1 FROM alerts_history h WHERE h.alert_id = r.id AND h.status = 'resolved'
					)
				`
				)
				.run();

			// Backward compatibility: ensure tags column exists
			const columns = this.db.prepare(`PRAGMA table_info(alerts_resolved)`).all() as TableInfoRow[];
			const hasTags = columns.some((col: TableInfoRow) => col.name === 'tags');

			if (!hasTags) {
				this.db.prepare(`ALTER TABLE alerts_resolved ADD COLUMN tags TEXT`).run();
			}

			// Backward compatibility: ensure owner_id column exists
			const hasOwnerId = columns.some((col: TableInfoRow) => col.name === 'owner_id');
			if (!hasOwnerId) {
				this.db.prepare(`ALTER TABLE alerts_resolved ADD COLUMN owner_id INTEGER REFERENCES users(id)`).run();
			}

			// Backward compatibility: ensure severity column exists
			const hasSeverity = columns.some((col: TableInfoRow) => col.name === 'severity');
			if (!hasSeverity) {
				this.db.prepare(`ALTER TABLE alerts_resolved ADD COLUMN severity TEXT`).run();
			}

			// Backward compatibility: ensure team column exists
			const hasTeam = columns.some((col: TableInfoRow) => col.name === 'team');
			if (!hasTeam) {
				this.db.prepare(`ALTER TABLE alerts_resolved ADD COLUMN team TEXT`).run();
			}
		});
	}

	async insertResolvedAlert(alert: SharedAlert): Promise<{ changes: number }> {
		return runAsync(() => {
			const stmt = this.db.prepare(`
                INSERT INTO alerts_resolved
                    (id, status, severity, team, tags, type, starts_at, updated_at, alert_url, alert_name, is_dismissed, summary, runbook_url, created_at, owner_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status = excluded.status,
                    severity = excluded.severity,
                    team = excluded.team,
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
				alert.severity,
				alert.team ?? null,
				JSON.stringify(alert.tags),
				alert.type,
				alert.startsAt,
				alert.updatedAt,
				alert.alertUrl,
				alert.alertName,
				// Resolving clears silence: an alert is either silenced or resolved, never both.
				0,
				alert.summary || null,
				alert.runbookUrl || null,
				alert.createdAt,
				alert.ownerId != null ? Number(alert.ownerId) : null
			);

			return { changes: result.changes };
		});
	}

	private toSharedAlert = (row: ResolvedAlertRow): SharedAlert => {
		const tags = row.tags ? (JSON.parse(row.tags) as Record<string, string>) : {};
		return {
			id: row.id,
			// Everything in this table is resolved by definition, whatever status the row
			// carried when it was written.
			status: AlertStatus.RESOLVED,
			// Legacy rows (pre-severity column) fall back to their severity tag, then the default.
			severity: normalizeAlertSeverity(row.severity ?? tags['severity']),
			// Legacy rows (pre-team column) fall back to their team tag.
			team: row.team ?? tags['team'] ?? null,
			tags,
			type: row.type,
			startsAt: row.starts_at,
			updatedAt: row.updated_at,
			alertUrl: row.alert_url,
			alertName: row.alert_name,
			summary: row.summary,
			runbookUrl: row.runbook_url,
			createdAt: row.created_at,
			// Resolved alerts are never silenced (legacy rows may still carry is_dismissed=1
			// from before resolving cleared the flag).
			isSilenced: false,
			ownerId: row.owner_id != null ? String(row.owner_id) : null,
		};
	};

	async getResolvedAlert(alertId: string): Promise<SharedAlert | null> {
		return runAsync(() => {
			const row = this.db.prepare('SELECT * FROM alerts_resolved WHERE id = ?').get(alertId) as
				| ResolvedAlertRow
				| undefined;
			return row ? this.toSharedAlert(row) : null;
		});
	}

	async getAllResolvedAlerts(): Promise<SharedAlert[]> {
		return runAsync(() => {
			const stmt = this.db.prepare('SELECT * FROM alerts_resolved ORDER BY archived_at DESC');
			const rows = stmt.all() as ResolvedAlertRow[];
			return rows.map(this.toSharedAlert);
		});
	}

	async deleteResolvedAlert(alertId: string): Promise<void> {
		return runAsync(() => {
			const stmt = this.db.prepare(`DELETE FROM alerts_resolved WHERE id = ?`);
			stmt.run(alertId);
		});
	}

	async updateResolvedAlertOwner(alertId: string, ownerId: number | null): Promise<SharedAlert | null> {
		return runAsync(() => {
			this.db.prepare('UPDATE alerts_resolved SET owner_id = ? WHERE id = ?').run(ownerId, alertId);
			const row = this.db.prepare('SELECT * FROM alerts_resolved WHERE id = ?').get(alertId) as
				| ResolvedAlertRow
				| undefined;
			return row ? this.toSharedAlert(row) : null;
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
					ORDER BY archived_at DESC 
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
