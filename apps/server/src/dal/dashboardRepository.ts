import Database from 'better-sqlite3';
import { runAsync } from './db';
import { DashboardRow, TableInfoRow } from './models';
import { Dashboard, DashboardTimeRange } from '@OpsiMate/shared';

// SQLite stores booleans as 0/1 and better-sqlite3 refuses to bind a JS boolean outright
// ("can only bind numbers, strings, bigints, buffers, and null"), so every boolean field
// has to cross this boundary explicitly. NULL is kept distinct from 0: it means the
// dashboard predates the column, which the client resolves from its legacy preference.
const toDbBoolean = (value: boolean | undefined): number | null => (value === undefined ? null : value ? 1 : 0);

const fromDbBoolean = (value: number | null | undefined): boolean | undefined =>
	value === null || value === undefined ? undefined : Boolean(value);

export class DashboardRepository {
	constructor(private db: Database.Database) {}

	private toSharedDashboard = (dashboardRow: DashboardRow): Dashboard => {
		return {
			id: dashboardRow.id,
			type: dashboardRow.type,
			name: dashboardRow.name,
			description: dashboardRow.description,
			filters: JSON.parse(dashboardRow.filters) as Record<string, unknown>,
			visibleColumns: JSON.parse(dashboardRow.visible_columns) as string[],
			query: dashboardRow.query,
			columnOrder: dashboardRow.column_order ? (JSON.parse(dashboardRow.column_order) as string[]) : undefined,
			splitByAssignment: fromDbBoolean(dashboardRow.split_by_assignment),
			severityColors: fromDbBoolean(dashboardRow.severity_colors),
			groupBy: JSON.parse(dashboardRow.group_by) as string[],
			timeRange: dashboardRow.time_range
				? (JSON.parse(dashboardRow.time_range) as DashboardTimeRange)
				: undefined,
			createdAt: dashboardRow.created_at,
		};
	};

	async getAllDashboards(): Promise<Dashboard[]> {
		return runAsync(() => {
			const rows = this.db.prepare(`SELECT * FROM dashboards`).all() as DashboardRow[];
			return rows.map(this.toSharedDashboard);
		});
	}

	async getDashboardById(id: string): Promise<Dashboard | null> {
		return runAsync(() => {
			const row: DashboardRow = this.db.prepare(`SELECT * FROM dashboards WHERE id = ?`).get(id) as DashboardRow;
			return row ? this.toSharedDashboard(row) : null;
		});
	}

	async createDashboard(dashboard: Omit<Dashboard, 'createdAt' | 'id'>): Promise<number> {
		return runAsync(() => {
			const stmt = this.db.prepare(`
                INSERT INTO dashboards (name, type, description, filters, visible_columns, column_order, split_by_assignment, severity_colors, query, group_by, time_range)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
			const result = stmt.run(
				dashboard.name,
				dashboard.type,
				dashboard.description,
				JSON.stringify(dashboard.filters),
				JSON.stringify(dashboard.visibleColumns),
				dashboard.columnOrder ? JSON.stringify(dashboard.columnOrder) : null,
				toDbBoolean(dashboard.splitByAssignment),
				toDbBoolean(dashboard.severityColors),
				dashboard.query,
				JSON.stringify(dashboard.groupBy),
				dashboard.timeRange ? JSON.stringify(dashboard.timeRange) : null
			);
			return result.lastInsertRowid as number;
		});
	}

	async deleteDashboard(id: string): Promise<boolean> {
		return runAsync(() => {
			const result = this.db.prepare(`DELETE FROM dashboards WHERE id = ?`).run(id);
			return result.changes > 0;
		});
	}

	async initDashboardTable(): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`
						CREATE TABLE IF NOT EXISTS dashboards
						(
							id              INTEGER PRIMARY KEY AUTOINCREMENT,
							type            TEXT NOT NULL,
							name            TEXT NOT NULL,
							description     TEXT,
							created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
							filters         TEXT NOT NULL,
							visible_columns TEXT NOT NULL,
							query           TEXT,
							group_by        TEXT NOT NULL,
							time_range      TEXT
						)
					`
				)
				.run();

			// Backward compatibility: ensure time_range column exists on older DBs
			const columns = this.db.prepare(`PRAGMA table_info(dashboards)`).all() as TableInfoRow[];
			if (!columns.some((col) => col.name === 'time_range')) {
				this.db.prepare(`ALTER TABLE dashboards ADD COLUMN time_range TEXT`).run();
			}
			// Backward compatibility: user-arranged column order (JSON string[]).
			if (!columns.some((col) => col.name === 'column_order')) {
				this.db.prepare(`ALTER TABLE dashboards ADD COLUMN column_order TEXT`).run();
			}
			// Backward compatibility: alerts toolbar toggles, 0/1 with NULL meaning "saved
			// before the toggle existed".
			if (!columns.some((col) => col.name === 'split_by_assignment')) {
				this.db.prepare(`ALTER TABLE dashboards ADD COLUMN split_by_assignment INTEGER`).run();
			}
			if (!columns.some((col) => col.name === 'severity_colors')) {
				this.db.prepare(`ALTER TABLE dashboards ADD COLUMN severity_colors INTEGER`).run();
			}
		});
	}

	async updateDashboard(dashboardId: string, dashboard: Omit<Dashboard, 'createdAt' | 'id'>): Promise<boolean> {
		return runAsync(() => {
			const stmt = this.db.prepare(`
            UPDATE dashboards
            SET
                name = ?,
                type = ?,
                description = ?,
                filters = ?,
                visible_columns = ?,
                column_order = ?,
                split_by_assignment = ?,
                severity_colors = ?,
                query = ?,
                group_by = ?,
                time_range = ?
            WHERE id = ?
        `);

			const result = stmt.run(
				dashboard.name,
				dashboard.type,
				dashboard.description,
				JSON.stringify(dashboard.filters),
				JSON.stringify(dashboard.visibleColumns),
				dashboard.columnOrder ? JSON.stringify(dashboard.columnOrder) : null,
				toDbBoolean(dashboard.splitByAssignment),
				toDbBoolean(dashboard.severityColors),
				dashboard.query,
				JSON.stringify(dashboard.groupBy),
				dashboard.timeRange ? JSON.stringify(dashboard.timeRange) : null,
				dashboardId
			);

			return result.changes > 0;
		});
	}
}
