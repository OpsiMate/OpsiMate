import { AlertSeverity, Incident, IncidentSummary } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { runAsync } from './db';

interface IncidentRow {
	id: number;
	name: string;
	description: string | null;
	created_by: number | null;
	created_at: string;
	updated_at: string;
}

// One roll-up row per incident, aggregated in SQL over BOTH alert tables (an incident
// whose members all resolved must still report its true state, not vanish).
interface IncidentSummaryRow extends IncidentRow {
	alert_count: number;
	firing_count: number;
	resolved_count: number;
	earliest_starts_at: string | null;
	latest_updated_at: string | null;
	// GROUP_CONCAT of distinct member severities, e.g. "critical,warning".
	severities: string | null;
	// GROUP_CONCAT of member alert ids.
	alert_ids: string | null;
}

export interface CreateIncidentInput {
	name: string;
	description: string | null;
	createdBy: number | null;
}

export interface UpdateIncidentInput {
	name?: string;
	description?: string | null;
}

// Worst-first; members carry free-text severity in theory, so anything unrecognized
// ranks below the known three and never masks a real critical.
const SEVERITY_RANK: Record<string, number> = {
	[AlertSeverity.CRITICAL]: 0,
	[AlertSeverity.WARNING]: 1,
	[AlertSeverity.INFO]: 2,
};

const worstSeverity = (severities: string | null): AlertSeverity | null => {
	if (!severities) return null;
	const known = severities
		.split(',')
		.filter((sev) => sev in SEVERITY_RANK)
		.sort((a, b) => SEVERITY_RANK[a] - SEVERITY_RANK[b]);
	return (known[0] as AlertSeverity) ?? null;
};

// Members live in `alerts` while active and `alerts_resolved` after resolution, under
// the SAME id — membership refers to the id, so the roll-up UNIONs the two tables.
// An id present in both (transiently, mid-move) counts once, preferring the active copy.
const MEMBER_STATE_CTE = `
	WITH member_state AS (
		SELECT ia.incident_id,
		       ia.alert_id,
		       COALESCE(a.severity, r.severity)                        AS severity,
		       COALESCE(a.starts_at, r.starts_at)                      AS starts_at,
		       COALESCE(a.updated_at, r.updated_at)                    AS updated_at,
		       CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END            AS is_active
		FROM incident_alerts ia
		LEFT JOIN alerts a          ON a.id = ia.alert_id
		LEFT JOIN alerts_resolved r ON r.id = ia.alert_id
	)
`;

export class IncidentRepository {
	constructor(private db: Database.Database) {}

	private toIncident = (row: IncidentRow): Incident => ({
		id: row.id,
		name: row.name,
		description: row.description,
		createdBy: row.created_by,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	});

	private toSummary = (row: IncidentSummaryRow): IncidentSummary => ({
		...this.toIncident(row),
		alertCount: row.alert_count,
		firingCount: row.firing_count,
		resolvedCount: row.resolved_count,
		worstSeverity: worstSeverity(row.severities),
		earliestStartsAt: row.earliest_starts_at,
		latestUpdatedAt: row.latest_updated_at,
		alertIds: row.alert_ids ? row.alert_ids.split(',') : [],
	});

	async initIncidentsTables(): Promise<void> {
		return runAsync(() => {
			this.db.exec(`
				CREATE TABLE IF NOT EXISTS incidents (
					id          INTEGER PRIMARY KEY AUTOINCREMENT,
					name        TEXT NOT NULL,
					description TEXT,
					created_by  INTEGER,
					created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
					updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
				);

				CREATE TABLE IF NOT EXISTS incident_alerts (
					incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
					-- UNIQUE: an alert belongs to AT MOST ONE incident. Adding it elsewhere
					-- re-homes it (the bl deletes the old membership first).
					alert_id    TEXT NOT NULL UNIQUE,
					added_at    DATETIME DEFAULT CURRENT_TIMESTAMP
				);

				CREATE INDEX IF NOT EXISTS idx_incident_alerts_incident
					ON incident_alerts (incident_id);
			`);
		});
	}

	async createIncident(data: CreateIncidentInput): Promise<{ lastID: number }> {
		return runAsync(() => {
			const result = this.db
				.prepare(`INSERT INTO incidents (name, description, created_by) VALUES (?, ?, ?)`)
				.run(data.name, data.description, data.createdBy);
			return { lastID: result.lastInsertRowid as number };
		});
	}

	async updateIncident(id: number, data: UpdateIncidentInput): Promise<void> {
		return runAsync(() => {
			const updates: string[] = [];
			const values: unknown[] = [];
			if (data.name !== undefined) {
				updates.push('name = ?');
				values.push(data.name);
			}
			if (data.description !== undefined) {
				updates.push('description = ?');
				values.push(data.description);
			}
			if (updates.length === 0) return;
			updates.push('updated_at = CURRENT_TIMESTAMP');
			values.push(id);
			this.db.prepare(`UPDATE incidents SET ${updates.join(', ')} WHERE id = ?`).run(...values);
		});
	}

	async getIncidentById(id: number): Promise<Incident | undefined> {
		return runAsync(() => {
			const row = this.db.prepare(`SELECT * FROM incidents WHERE id = ?`).get(id) as IncidentRow | undefined;
			return row ? this.toIncident(row) : undefined;
		});
	}

	async getIncidentSummaries(): Promise<IncidentSummary[]> {
		return runAsync(() => {
			const rows = this.db
				.prepare(
					`${MEMBER_STATE_CTE}
					SELECT i.*,
					       COUNT(ms.alert_id)                                   AS alert_count,
					       COALESCE(SUM(ms.is_active), 0)                       AS firing_count,
					       COUNT(ms.alert_id) - COALESCE(SUM(ms.is_active), 0)  AS resolved_count,
					       MIN(ms.starts_at)                                    AS earliest_starts_at,
					       MAX(ms.updated_at)                                   AS latest_updated_at,
					       GROUP_CONCAT(DISTINCT ms.severity)                   AS severities,
					       GROUP_CONCAT(ms.alert_id)                            AS alert_ids
					FROM incidents i
					LEFT JOIN member_state ms ON ms.incident_id = i.id
					GROUP BY i.id
					ORDER BY i.created_at DESC`
				)
				.all() as IncidentSummaryRow[];
			return rows.map(this.toSummary);
		});
	}

	async getIncidentSummaryById(id: number): Promise<IncidentSummary | undefined> {
		return runAsync(() => {
			const row = this.db
				.prepare(
					`${MEMBER_STATE_CTE}
					SELECT i.*,
					       COUNT(ms.alert_id)                                   AS alert_count,
					       COALESCE(SUM(ms.is_active), 0)                       AS firing_count,
					       COUNT(ms.alert_id) - COALESCE(SUM(ms.is_active), 0)  AS resolved_count,
					       MIN(ms.starts_at)                                    AS earliest_starts_at,
					       MAX(ms.updated_at)                                   AS latest_updated_at,
					       GROUP_CONCAT(DISTINCT ms.severity)                   AS severities,
					       GROUP_CONCAT(ms.alert_id)                            AS alert_ids
					FROM incidents i
					LEFT JOIN member_state ms ON ms.incident_id = i.id
					WHERE i.id = ?
					GROUP BY i.id`
				)
				.get(id) as IncidentSummaryRow | undefined;
			return row ? this.toSummary(row) : undefined;
		});
	}

	// Re-homing on purpose: INSERT OR REPLACE moves an alert already grouped elsewhere
	// into this incident (the UNIQUE on alert_id makes REPLACE delete the old row).
	// Returns the incidents the moved alerts came FROM, so the caller can dissolve any
	// that this move emptied and write accurate history.
	async addAlerts(incidentId: number, alertIds: string[]): Promise<{ previousIncidentIds: number[] }> {
		return runAsync(() => {
			const placeholders = alertIds.map(() => '?').join(', ');
			const previous = this.db
				.prepare(
					`SELECT DISTINCT incident_id FROM incident_alerts
					 WHERE alert_id IN (${placeholders}) AND incident_id != ?`
				)
				.all(...alertIds, incidentId) as { incident_id: number }[];
			const insert = this.db.prepare(
				`INSERT OR REPLACE INTO incident_alerts (incident_id, alert_id) VALUES (?, ?)`
			);
			const touch = this.db.prepare(`UPDATE incidents SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
			this.db.transaction(() => {
				for (const alertId of alertIds) insert.run(incidentId, alertId);
				touch.run(incidentId);
			})();
			return { previousIncidentIds: previous.map((p) => p.incident_id) };
		});
	}

	async removeAlerts(incidentId: number, alertIds: string[]): Promise<void> {
		return runAsync(() => {
			const placeholders = alertIds.map(() => '?').join(', ');
			this.db.transaction(() => {
				this.db
					.prepare(`DELETE FROM incident_alerts WHERE incident_id = ? AND alert_id IN (${placeholders})`)
					.run(incidentId, ...alertIds);
				this.db.prepare(`UPDATE incidents SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(incidentId);
			})();
		});
	}

	async getMemberCount(incidentId: number): Promise<number> {
		return runAsync(() => {
			const row = this.db
				.prepare(`SELECT COUNT(*) AS n FROM incident_alerts WHERE incident_id = ?`)
				.get(incidentId) as { n: number };
			return row.n;
		});
	}

	// Ungroup: the incident dies, member alerts survive untouched. Returns the member
	// ids so the caller can write per-alert history.
	async deleteIncident(id: number): Promise<{ memberAlertIds: string[] }> {
		return runAsync(() => {
			const members = this.db
				.prepare(`SELECT alert_id FROM incident_alerts WHERE incident_id = ?`)
				.all(id) as { alert_id: string }[];
			this.db.transaction(() => {
				this.db.prepare(`DELETE FROM incident_alerts WHERE incident_id = ?`).run(id);
				this.db.prepare(`DELETE FROM incidents WHERE id = ?`).run(id);
			})();
			return { memberAlertIds: members.map((m) => m.alert_id) };
		});
	}

	// alertId -> incidentId for the whole mapping table: the alert snapshots attach
	// incidentId to every alert in one pass with this.
	async getMembershipMap(): Promise<Map<string, number>> {
		return runAsync(() => {
			const rows = this.db.prepare(`SELECT alert_id, incident_id FROM incident_alerts`).all() as {
				alert_id: string;
				incident_id: number;
			}[];
			return new Map(rows.map((r) => [r.alert_id, r.incident_id]));
		});
	}

	// Self-healing sweep for HARD deletions that bypass the incident endpoints —
	// retention purges resolved alerts with raw SQL, and nothing stops direct DB
	// surgery either. Memberships whose alert exists in neither table are dropped, and
	// incidents left empty dissolve — but only after a minute's grace: create() inserts
	// the incident before its first members, and a concurrent sweep in that gap would
	// eat the newborn.
	async pruneDanglingMemberships(): Promise<void> {
		return runAsync(() => {
			this.db.transaction(() => {
				this.db
					.prepare(
						`DELETE FROM incident_alerts
						 WHERE alert_id NOT IN (SELECT id FROM alerts)
						   AND alert_id NOT IN (SELECT id FROM alerts_resolved)`
					)
					.run();
				this.db
					.prepare(
						`DELETE FROM incidents
						 WHERE id NOT IN (SELECT DISTINCT incident_id FROM incident_alerts)
						   AND datetime(created_at) < datetime('now', '-1 minute')`
					)
					.run();
			})();
		});
	}

	// Delete-forever of a resolved alert must not leave a dangling membership. Returns
	// the incidents affected so the caller can dissolve any that became empty.
	async removeMembershipForAlerts(alertIds: string[]): Promise<{ affectedIncidentIds: number[] }> {
		if (alertIds.length === 0) return { affectedIncidentIds: [] };
		return runAsync(() => {
			const placeholders = alertIds.map(() => '?').join(', ');
			const affected = this.db
				.prepare(`SELECT DISTINCT incident_id FROM incident_alerts WHERE alert_id IN (${placeholders})`)
				.all(...alertIds) as { incident_id: number }[];
			this.db.prepare(`DELETE FROM incident_alerts WHERE alert_id IN (${placeholders})`).run(...alertIds);
			return { affectedIncidentIds: affected.map((a) => a.incident_id) };
		});
	}
}
