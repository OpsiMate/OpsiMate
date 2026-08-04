import {
	AlertStatus,
	AlertType,
	normalizeAlertSeverity,
	Alert as SharedAlert,
	SilenceResetSettings,
	UpdateSilenceResetSettings,
} from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { runAsync } from './db';
import { toIsoUtc } from '../utils/time';
import { AlertRow, TableInfoRow } from './models';

export class AlertRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	// Serialize tags with keys in a stable (sorted) order so the SAME set of tags always
	// produces the SAME stored string. The is_read comparison in insertOrUpdateAlert diffs
	// the stored tags string against the incoming one; without canonical order a source that
	// merely reorders identical keys would look "changed" and wrongly re-bold a read alert.
	private static serializeTags(tags?: Record<string, string> | null): string {
		if (!tags) return '{}';
		return JSON.stringify(
			Object.fromEntries(Object.keys(tags).sort().map((k) => [k, tags[k]]))
		);
	}

	async insertOrUpdateAlert(alert: Omit<SharedAlert, 'createdAt' | 'isSilenced'>): Promise<{ changes: number }> {
		return runAsync(() => {
			// starts_at is deliberately NOT in the DO UPDATE clause: "Started At" means when
			// the current firing episode began. Sources that re-send an active alert with a
			// fresh startsAt (some push "now" on every notification) must not drag it forward —
			// the firing-history trigger only fires on INSERT, so a moving starts_at diverges
			// from the recorded firing time. A new episode (resolve, then re-fire) deletes and
			// re-inserts the row, which picks up the new starts_at.
			const stmt = this.db.prepare(`
				INSERT INTO alerts (id, status, type, severity, team, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
											  status=excluded.status,
											  type=excluded.type,
											  severity=excluded.severity,
											  team=excluded.team,
											  tags=excluded.tags,
											  updated_at=excluded.updated_at,
											  alert_url=excluded.alert_url,
											  alert_name=excluded.alert_name,
											  summary=excluded.summary,
											  runbook_url=excluded.runbook_url,
											  -- An alert whose content actually changed is "new" again: mark it unread
											  -- so the row re-bolds, exactly like a freshly inserted alert. Compared with
											  -- IS NOT (null-safe) against the incoming values; updated_at is excluded on
											  -- purpose because sources that push "now" on every replay would otherwise
											  -- flip read alerts back to unread on each poll with no real change.
											  is_read=CASE
												WHEN alerts.status IS NOT excluded.status
													OR alerts.severity IS NOT excluded.severity
													OR alerts.team IS NOT excluded.team
													OR alerts.tags IS NOT excluded.tags
													OR alerts.alert_name IS NOT excluded.alert_name
													OR alerts.summary IS NOT excluded.summary
													OR alerts.runbook_url IS NOT excluded.runbook_url
													OR alerts.alert_url IS NOT excluded.alert_url
												THEN 0
												ELSE alerts.is_read
											  END
			`);

			// An alert id must never live in both tables: if this alert was previously
			// resolved (manually or by a source) and is now firing again, drop the resolved
			// copy — the active row is the truth. Same transaction as the upsert so a
			// failure between the two can't leave the alert in neither table.
			const upsert = this.db.transaction(() => {
				// Re-fire after a resolve = a new episode. Sources often replay the ORIGINAL
				// incident startsAt on the re-fire push; trusting that claim would show a
				// freshly re-activated alert as weeks old. If the claimed start predates the
				// resolve that ended the previous episode (a contradiction — it can't have
				// started before it last ended), stamp the observed re-fire moment instead.
				// A claimed start AFTER the resolve is a genuine fresh start and is kept.
				let startsAt = alert.startsAt;
				const resolvedCopy = this.db
					.prepare(`SELECT archived_at, updated_at FROM alerts_resolved WHERE id = ?`)
					.get(alert.id) as { archived_at: string | null; updated_at: string } | undefined;
				if (resolvedCopy) {
					const resolveMoment = new Date(
						toIsoUtc(resolvedCopy.archived_at ?? resolvedCopy.updated_at)
					).getTime();
					const claimed = new Date(startsAt).getTime();
					if (isNaN(claimed) || (!isNaN(resolveMoment) && claimed <= resolveMoment)) {
						startsAt = new Date().toISOString();
					}
				}
				this.db.prepare(`DELETE FROM alerts_resolved WHERE id = ?`).run(alert.id);
				return stmt.run(
					alert.id,
					alert.status,
					alert.type,
					alert.severity,
					alert.team ?? null,
					AlertRepository.serializeTags(alert.tags),
					startsAt,
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
						INSERT INTO alerts (id, status, type, severity, team, tags, starts_at, updated_at, alert_url, alert_name, summary, runbook_url, is_dismissed, is_read, created_at, owner_id)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
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
						alert.team ?? null,
						AlertRepository.serializeTags(alert.tags),
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
	
				CREATE TABLE IF NOT EXISTS silence_reset_config (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					enabled INTEGER NOT NULL DEFAULT 0,
					hour INTEGER NOT NULL DEFAULT 0,
					last_cleared_at TEXT,
					updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
				);

				CREATE TRIGGER IF NOT EXISTS archive_alert_on_insert
					AFTER INSERT ON alerts
					FOR EACH ROW
				BEGIN
					INSERT INTO alerts_history (alert_id, status, archived_at)
					VALUES (NEW.id, NEW.status, NEW.starts_at);
				END;
        	`);

			// The trigger's definition changed over time (older versions stamped the insert
			// moment instead of starts_at), and CREATE TRIGGER IF NOT EXISTS never upgrades
			// an existing DB — so installs drifted apart. Recreate it whenever the stored
			// definition doesn't stamp starts_at, so every install runs the current version.
			const triggerSql = (
				this.db
					.prepare(
						`SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'archive_alert_on_insert'`
					)
					.get() as { sql: string } | undefined
			)?.sql;
			if (triggerSql && !triggerSql.includes('NEW.starts_at')) {
				this.db.exec(`
					DROP TRIGGER archive_alert_on_insert;
					CREATE TRIGGER archive_alert_on_insert
						AFTER INSERT ON alerts
						FOR EACH ROW
					BEGIN
						INSERT INTO alerts_history (alert_id, status, archived_at)
						VALUES (NEW.id, NEW.status, NEW.starts_at);
					END;
				`);
			}

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

			// Backward compatibility: ensure team column exists
			const hasTeam = columns.some((col: TableInfoRow) => col.name === 'team');
			if (!hasTeam) {
				this.db.prepare(`ALTER TABLE alerts ADD COLUMN team TEXT`).run();
			}

			// Backward compatibility: ensure silenced_until column exists (ISO expiry of a
			// timed silence; NULL while silenced means silenced forever)
			const hasSilencedUntil = columns.some((col: TableInfoRow) => col.name === 'silenced_until');
			if (!hasSilencedUntil) {
				this.db.prepare(`ALTER TABLE alerts ADD COLUMN silenced_until TEXT`).run();
			}

			// When the silence was established (ISO). The daily reset clears only silences
			// created on or before the day's reset occurrence, so it needs this timestamp;
			// NULL (pre-migration silences) is treated as old and swept.
			const hasSilencedAt = columns.some((col: TableInfoRow) => col.name === 'silenced_at');
			if (!hasSilencedAt) {
				this.db.prepare(`ALTER TABLE alerts ADD COLUMN silenced_at TEXT`).run();
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
			// Legacy rows (pre-team column) fall back to their team tag.
			team: row.team ?? tags['team'] ?? null,
			tags,
			// Normalized so the client never receives SQLite's marker-less UTC format
			// (which browsers would parse as local time and display shifted).
			startsAt: toIsoUtc(row.starts_at),
			updatedAt: toIsoUtc(row.updated_at),
			alertUrl: row.alert_url,
			alertName: row.alert_name,
			summary: row.summary,
			runbookUrl: row.runbook_url,
			createdAt: row.created_at,
			isSilenced: row.is_dismissed ? true : false,
			silencedUntil: row.is_dismissed ? (row.silenced_until ?? null) : null,
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

	// silencedUntil is written unconditionally — re-silencing an already-silenced alert
	// restarts the timer with the newly chosen duration (null = forever).
	async silenceAlert(id: string, silencedUntil: string | null): Promise<SharedAlert | null> {
		return runAsync(() => {
			this.db
				.prepare('UPDATE alerts SET is_dismissed = 1, silenced_until = ?, silenced_at = ? WHERE id = ?')
				.run(silencedUntil, new Date().toISOString(), id);
			const row = this.db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as AlertRow | undefined;
			return row ? this.toSharedAlert(row) : null;
		});
	}

	// Un-silences every alert whose timed silence has passed and returns their ids so the
	// caller can record history events. ISO-8601 strings compare lexicographically, so plain
	// string comparison against "now" is correct.
	async clearExpiredSilences(nowIso: string): Promise<string[]> {
		return runAsync(() => {
			const sweep = this.db.transaction(() => {
				const rows = this.db
					.prepare(
						`SELECT id FROM alerts WHERE is_dismissed = 1 AND silenced_until IS NOT NULL AND silenced_until <= ?`
					)
					.all(nowIso) as { id: string }[];
				if (rows.length > 0) {
					this.db
						.prepare(
							`UPDATE alerts SET is_dismissed = 0, silenced_until = NULL, silenced_at = NULL
							 WHERE is_dismissed = 1 AND silenced_until IS NOT NULL AND silenced_until <= ?`
						)
						.run(nowIso);
				}
				return rows.map((r) => r.id);
			});
			return sweep();
		});
	}

	// Daily reset sweep: unsilence every silence established on or before the reset
	// occurrence, whatever its remaining window (including no-expiry quick-silences).
	// Silences created after the occurrence survive until the next day's reset — even
	// when the sweep runs late because nothing listed the alerts for a while. NULL
	// silenced_at (silences from before the column existed) counts as old and is swept.
	// Returns the affected ids for history entries.
	async clearSilencesEstablishedBy(cutoffIso: string): Promise<string[]> {
		return runAsync(() => {
			const sweep = this.db.transaction(() => {
				const rows = this.db
					.prepare(
						`SELECT id FROM alerts WHERE is_dismissed = 1 AND (silenced_at IS NULL OR silenced_at <= ?)`
					)
					.all(cutoffIso) as { id: string }[];
				if (rows.length > 0) {
					this.db
						.prepare(
							`UPDATE alerts SET is_dismissed = 0, silenced_until = NULL, silenced_at = NULL
							 WHERE is_dismissed = 1 AND (silenced_at IS NULL OR silenced_at <= ?)`
						)
						.run(cutoffIso);
				}
				return rows.map((r) => r.id);
			});
			return sweep();
		});
	}

	async getSilenceResetSettings(): Promise<SilenceResetSettings> {
		return runAsync(() => {
			const row = this.db
				.prepare(`SELECT enabled, hour, last_cleared_at FROM silence_reset_config WHERE id = 1`)
				.get() as { enabled: number; hour: number; last_cleared_at: string | null } | undefined;
			return {
				enabled: row ? !!row.enabled : false,
				hour: row?.hour ?? 0,
				lastClearedAt: row?.last_cleared_at ?? null,
			};
		});
	}

	async updateSilenceResetSettings(updates: UpdateSilenceResetSettings): Promise<SilenceResetSettings> {
		await runAsync(() => {
			this.db
				.prepare(
					`INSERT INTO silence_reset_config (id, enabled, hour)
					 VALUES (1, COALESCE(?, 0), COALESCE(?, 0))
					 ON CONFLICT (id) DO UPDATE SET
						enabled = COALESCE(?, enabled),
						hour = COALESCE(?, hour),
						updated_at = CURRENT_TIMESTAMP`
				)
				.run(
					updates.enabled === undefined ? null : updates.enabled ? 1 : 0,
					updates.hour ?? null,
					updates.enabled === undefined ? null : updates.enabled ? 1 : 0,
					updates.hour ?? null
				);
		});
		return this.getSilenceResetSettings();
	}

	async markSilenceResetCleared(occurrenceIso: string): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`INSERT INTO silence_reset_config (id, enabled, hour, last_cleared_at)
					 VALUES (1, 0, 0, ?)
					 ON CONFLICT (id) DO UPDATE SET last_cleared_at = ?`
				)
				.run(occurrenceIso, occurrenceIso);
		});
	}

	// Firing-transition timestamps for the given alerts, from the status-history trigger
	// records (first fire, webhook re-fires, unresolve re-inserts). Raw values — the BL
	// merges them with unresolve events and normalizes to ISO. Scoped to the listed ids
	// so the work doesn't grow with total history retention.
	async getFiringTimesByAlert(alertIds: string[]): Promise<Record<string, string[]>> {
		if (alertIds.length === 0) return {};
		return runAsync(() => {
			const placeholders = alertIds.map(() => '?').join(', ');
			const rows = this.db
				.prepare(
					`SELECT alert_id, archived_at FROM alerts_history
					 WHERE status = 'firing' AND alert_id IN (${placeholders})`
				)
				.all(...alertIds) as { alert_id: string; archived_at: string }[];
			const result: Record<string, string[]> = {};
			for (const row of rows) {
				(result[row.alert_id] ??= []).push(row.archived_at);
			}
			return result;
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
			this.db
				.prepare('UPDATE alerts SET is_dismissed = 0, silenced_until = NULL, silenced_at = NULL WHERE id = ?')
				.run(id);
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
