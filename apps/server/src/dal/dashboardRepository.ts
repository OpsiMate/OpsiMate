import Database from 'better-sqlite3';
import { runAsync } from './db';
import { DashboardRow } from './models';
import { Dashboard } from '@OpsiMate/shared';

export class DashboardRepository {
	constructor(private db: Database.Database) {}

	private toSharedDashboard = (dashboardRow: DashboardRow): Dashboard => {
		return {
			id: dashboardRow.id,
			type: dashboardRow.type,
			name: dashboardRow.name,
			filters: JSON.parse(dashboardRow.filters) as Record<string, unknown>,
			visibleColumns: JSON.parse(dashboardRow.visible_columns) as string[],
			query: dashboardRow.query,
			groupBy: JSON.parse(dashboardRow.group_by) as string[],
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
                INSERT INTO dashboards (name, type, description, filters, visible_columns, query, group_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
			const result = stmt.run(
				dashboard.name,
				dashboard.type,
				dashboard.description,
				JSON.stringify(dashboard.filters),
				JSON.stringify(dashboard.visibleColumns),
				dashboard.query,
				JSON.stringify(dashboard.groupBy)
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
							group_by        TEXT NOT NULL
						)
					`
				)
				.run();
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
                group_by = ?
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
				dashboardId
			);

			return result.changes > 0;
		});
	}
}
