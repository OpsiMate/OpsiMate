import Database from 'better-sqlite3';
import { runAsync } from './db';
import { DashboardRow, TableInfoRow } from './models';
import { Dashboard, DashboardTimeRange } from '@OpsiMate/shared';

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
                INSERT INTO dashboards (name, type, description, filters, visible_columns, query, group_by, time_range)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
			const result = stmt.run(
				dashboard.name,
				dashboard.type,
				dashboard.description,
				JSON.stringify(dashboard.filters),
				JSON.stringify(dashboard.visibleColumns),
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
				dashboard.query,
				JSON.stringify(dashboard.groupBy),
				dashboard.timeRange ? JSON.stringify(dashboard.timeRange) : null,
				dashboardId
			);

			return result.changes > 0;
		});
	}
}
