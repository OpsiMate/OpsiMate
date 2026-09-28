import { AlertStatus, Alert as SharedAlert, AlertHistory, normalizeAlertSeverity } from '@OpsiMate/shared';
import { toIsoUtc } from '../utils/time';
import Database from 'better-sqlite3';
import { runAsync } from './db';
import { ResolvedAlertRow, TableInfoRow } from './models';

// The compact projection getAllHistoryRows returns for the analytics aggregates.
export interface HistoryStatusRow {
	alert_id: string;
	status: string;
	archived_at: string;
}

// What insertResolvedOnlyEpisode found: it recorded the episode, the alert is firing
// after all, or a resolved record already exists.
export type ResolveOnlyOutcome = 'created' | 'active' | 'exists';

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
																	   links TEXT,
																	   created_at TEXT,
																	   archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
						);

						CREATE TABLE IF NOT EXISTS alerts_history (
																	  history_id INTEGER PRIMARY KEY AUTOINCREMENT,
																	  alert_id TEXT NOT NULL,
																	  archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
																	  status TEXT NOT NULL
						);

						-- Every hot read of this table probes by alert_id:
						-- getFiringTimesByAlert runs inside EVERY active-snapshot recompute
						-- (feeding the alerts list, facets and groups) and getAlertHistory
						-- backs the per-alert history drawer. Without the index both were
						-- full scans, so main-page latency grew with TOTAL history size —
						-- history a user never looks at taxed every poll. archived_at as the
						-- second column serves the drawer's ORDER BY straight off the index
						-- (status still comes from the row — a covering index isn't worth
						-- the write cost on the trigger-driven insert path).
						CREATE INDEX IF NOT EXISTS idx_alerts_history_alert
							ON alerts_history (alert_id, archived_at);

						`
			);

			// The resolved-status history rows are stamped by these triggers. They must use
			// millisecond ISO-8601 UTC, the same form the firing rows carry (starts_at):
			// the column default CURRENT_TIMESTAMP is second-precision "YYYY-MM-DD HH:MM:SS",
			// so an alert that fired and resolved within the same second got a resolve that
			// sorted BEFORE its own firing — history then showed "firing" as the last status.
			// CREATE TRIGGER IF NOT EXISTS never upgrades an existing definition, so replace
			// any trigger that doesn't stamp this way.
			const HISTORY_NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
			const HISTORY_TRIGGERS: Record<string, string> = {
				archive_alert_history_on_update: `
					CREATE TRIGGER archive_alert_history_on_update
						BEFORE UPDATE ON alerts_resolved
						FOR EACH ROW
					BEGIN
						INSERT INTO alerts_history (alert_id, status, archived_at)
						VALUES (OLD.id, OLD.status, ${HISTORY_NOW});
					END;`,
				archive_alert_history_on_insert: `
					CREATE TRIGGER archive_alert_history_on_insert
						AFTER INSERT ON alerts_resolved
						FOR EACH ROW
					BEGIN
						INSERT INTO alerts_history (alert_id, status, archived_at)
						VALUES (NEW.id, NEW.status, ${HISTORY_NOW});
					END;`,
			};
			for (const [name, definition] of Object.entries(HISTORY_TRIGGERS)) {
				const existing = (
					this.db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?`).get(name) as
						{ sql: string } | undefined
				)?.sql;
				if (existing?.includes('strftime')) continue;
				if (existing) this.db.exec(`DROP TRIGGER ${name}`);
				this.db.exec(definition);
			}

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
			// Marks an episode recorded from a resolve whose firing never arrived (see
			// insertResolvedOnlyEpisode). The ingest path uses it to recognise the late,
			// out-of-order firing of that same episode instead of reopening the alert.
			if (!columns.some((col: TableInfoRow) => col.name === 'resolved_without_firing')) {
				this.db
					.prepare(
						`ALTER TABLE alerts_resolved ADD COLUMN resolved_without_firing INTEGER NOT NULL DEFAULT 0`
					)
					.run();
			}

			const hasOwnerId = columns.some((col: TableInfoRow) => col.name === 'owner_id');
			if (!hasOwnerId) {
				this.db.prepare(`ALTER TABLE alerts_resolved ADD COLUMN owner_id INTEGER REFERENCES users(id)`).run();
			}

			// Backward compatibility: ensure severity column exists
			const hasSeverity = columns.some((col: TableInfoRow) => col.name === 'severity');
			if (!hasSeverity) {
				this.db.prepare(`ALTER TABLE alerts_resolved ADD COLUMN severity TEXT`).run();
			}

			// Backward compatibility: ensure links column exists (JSON array of AlertLink)
			const hasLinks = columns.some((col: TableInfoRow) => col.name === 'links');
			if (!hasLinks) {
				this.db.prepare(`ALTER TABLE alerts_resolved ADD COLUMN links TEXT`).run();
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
                    (id, status, severity, team, tags, type, starts_at, updated_at, alert_url, alert_name, is_dismissed, summary, runbook_url, links, created_at, owner_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    links = excluded.links,
                    created_at = excluded.created_at,
                    owner_id = excluded.owner_id,
                    resolved_without_firing = 0,
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
				alert.links?.length ? JSON.stringify(alert.links) : null,
				alert.createdAt,
				alert.ownerId != null ? Number(alert.ownerId) : null
			);

			return { changes: result.changes };
		});
	}

	// Records a whole episode — fired and already resolved — for a source that reported
	// the resolve of an alert OpsiMate never saw firing. Everything happens in one
	// transaction and the status history is written explicitly with ISO timestamps
	// (the insert trigger's CURRENT_TIMESTAMP has only second precision and a different
	// format, which could sort the resolve before its own firing):
	//   1. the 'firing' row at startsAt
	//   2. the resolved alert itself (its insert trigger adds the 'resolved' row)
	//   3. that 'resolved' row re-stamped at resolvedAt
	// startsAt <= resolvedAt is the caller's contract. When they are equal (the source
	// sent no start time) the 'resolved' row is written second, so it has the higher
	// history_id and wins every tie: it is the alert's last status.
	//
	// The existence checks run inside the same write-locked transaction as the insert, so
	// two concurrent retries cannot both create it, and a firing committed a moment ago
	// is reported back ('active') instead of ending up in both tables.
	// created_at is the moment OpsiMate recorded the episode (not the source's end time):
	// the ingest path measures its late-firing window from it.
	insertResolvedOnlyEpisode(alert: SharedAlert, startsAt: string, resolvedAt: string): ResolveOnlyOutcome {
		const isActive = this.db.prepare(`SELECT 1 FROM alerts WHERE id = ?`);
		const isResolved = this.db.prepare(`SELECT 1 FROM alerts_resolved WHERE id = ?`);
		const insertFiring = this.db.prepare(
			`INSERT INTO alerts_history (alert_id, status, archived_at) VALUES (?, 'firing', ?)`
		);
		const insertResolved = this.db.prepare(`
			INSERT INTO alerts_resolved
				(id, status, severity, team, tags, type, starts_at, updated_at, alert_url, alert_name, is_dismissed,
				 summary, runbook_url, links, created_at, owner_id, archived_at, resolved_without_firing)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NULL, ?, 1)
		`);
		const restampResolved = this.db.prepare(`
			UPDATE alerts_history SET archived_at = ?
			WHERE history_id = (
				SELECT MAX(history_id) FROM alerts_history WHERE alert_id = ? AND status = 'resolved'
			)
		`);
		const recordedAt = new Date().toISOString();
		return this.db
			.transaction((): ResolveOnlyOutcome => {
				if (isActive.get(alert.id)) return 'active';
				if (isResolved.get(alert.id)) return 'exists';
				insertFiring.run(alert.id, startsAt);
				insertResolved.run(
					alert.id,
					AlertStatus.RESOLVED,
					alert.severity,
					alert.team ?? null,
					JSON.stringify(alert.tags ?? {}),
					alert.type,
					startsAt,
					resolvedAt,
					alert.alertUrl ?? '',
					alert.alertName,
					alert.summary || null,
					alert.runbookUrl || null,
					alert.links?.length ? JSON.stringify(alert.links) : null,
					recordedAt,
					resolvedAt
				);
				restampResolved.run(resolvedAt, alert.id);
				return 'created';
			})
			.immediate();
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
			startsAt: toIsoUtc(row.starts_at),
			updatedAt: toIsoUtc(row.updated_at),
			alertUrl: row.alert_url,
			alertName: row.alert_name,
			summary: row.summary,
			runbookUrl: row.runbook_url,
			links: row.links ? (JSON.parse(row.links) as SharedAlert['links']) : undefined,
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
				ResolvedAlertRow | undefined;
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

	// Returns the number of rows removed so callers can tell a real deletion from a
	// no-op (an id that names an ACTIVE alert deletes nothing here — and must not
	// trigger permanent-deletion side effects like root-cause cleanup).
	async deleteResolvedAlert(alertId: string): Promise<number> {
		return runAsync(() => {
			const stmt = this.db.prepare(`DELETE FROM alerts_resolved WHERE id = ?`);
			return stmt.run(alertId).changes;
		});
	}

	async updateResolvedAlertOwner(alertId: string, ownerId: number | null): Promise<SharedAlert | null> {
		return runAsync(() => {
			this.db.prepare('UPDATE alerts_resolved SET owner_id = ? WHERE id = ?').run(ownerId, alertId);
			const row = this.db.prepare('SELECT * FROM alerts_resolved WHERE id = ?').get(alertId) as
				ResolvedAlertRow | undefined;
			return row ? this.toSharedAlert(row) : null;
		});
	}

	// Every status row for every alert, for the analytics aggregates. Compact columns
	// only; on large installations this is tens of thousands of small rows, which the
	// analytics module reduces to a few hundred bytes of aggregates.
	async getAllHistoryRows(): Promise<HistoryStatusRow[]> {
		return runAsync(() => {
			return this.db
				.prepare(`SELECT alert_id, status, archived_at FROM alerts_history`)
				.all() as HistoryStatusRow[];
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
					-- Newest first; on an exact tie the later-written row is the later event.
					ORDER BY archived_at DESC, history_id DESC
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
