import Database from "better-sqlite3";
import { runAsync } from "./db";
import {ViewRow} from "./models";

export interface SavedView {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  filters: Record<string, unknown>;
  visibleColumns: Record<string, boolean>;
  searchTerm: string;
  isDefault?: number;
}

export class ViewRepository {
  constructor(private db: Database.Database) {}

  async getAllViews(): Promise<SavedView[]> {
    return runAsync(() => {
      const rows = this.db.prepare(`SELECT * FROM views`).all() as ViewRow[];
      return rows.map((view: ViewRow) => ({
        ...view,
        filters: JSON.parse(view.filters) as Record<string, unknown>,
        visibleColumns: JSON.parse(view.visibleColumns) as Record<string, boolean>,
      }));
    });
  }

  async getViewById(id: string): Promise<SavedView | null> {
    return runAsync(() => {
      const row: ViewRow = this.db.prepare(`SELECT * FROM views WHERE id = ?`).get(id) as ViewRow;
      if (!row) return null;
      return {
        ...row,
        filters: JSON.parse(row.filters) as Record<string, unknown>,
        visibleColumns: JSON.parse(row.visibleColumns) as Record<string, boolean>,
      };
    });
  }

  async createView(view: SavedView): Promise<SavedView | null> {
    return runAsync(() => {
      const stmt = this.db.prepare(`
        INSERT INTO views (id, name, description, createdAt, filters, visibleColumns, searchTerm)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
          view.id,
          view.name,
          view.description || '',
          view.createdAt,
          JSON.stringify(view.filters),
          JSON.stringify(view.visibleColumns),
          view.searchTerm
      );
      return view;
    });
  }

  async updateView(view: SavedView): Promise<SavedView | null> {
    return runAsync(() => {
      const stmt = this.db.prepare(`
        UPDATE views
        SET name = ?, description = ?, filters = ?, visibleColumns = ?, searchTerm = ?
        WHERE id = ?
      `);
      stmt.run(
          view.name,
          view.description || '',
          JSON.stringify(view.filters),
          JSON.stringify(view.visibleColumns),
          view.searchTerm,
          view.id
      );
      return view;
    });
  }

  async deleteView(id: string): Promise<boolean> {
    return runAsync(() => {
      const isDefaultView: { isDefault: number } = this.db.prepare(`SELECT isDefault FROM views WHERE id = ?`).get(id) as { isDefault: number };
      if (isDefaultView?.isDefault === 1) return false;

      const result = this.db.prepare(`DELETE FROM views WHERE id = ?`).run(id);
      return result.changes > 0;
    });
  }

  async saveActiveViewId(viewId: string): Promise<boolean> {
    return runAsync(() => {
      const prefs = this.db.prepare(`SELECT * FROM view_preferences WHERE id = 1`).get();
      if (prefs) {
        this.db.prepare(`UPDATE view_preferences SET activeViewId = ? WHERE id = 1`).run(viewId);
      } else {
        this.db.prepare(`INSERT INTO view_preferences (id, activeViewId) VALUES (1, ?)`).run(viewId);
      }
      return true;
    });
  }

  async getActiveViewId(): Promise<string | null> {
    return runAsync(() => {
      const prefs: { activeViewId: string } = this.db.prepare(`SELECT activeViewId FROM view_preferences WHERE id = 1`).get() as { activeViewId: string };
      return prefs?.activeViewId || null;
    });
  }

  async initViewsTable(): Promise<void> {
    return runAsync(() => {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS views (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          createdAt TEXT NOT NULL,
          filters TEXT NOT NULL,
          visibleColumns TEXT NOT NULL,
          searchTerm TEXT,
          isDefault INTEGER DEFAULT 0
        )
      `).run();

      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS view_preferences (
          id INTEGER PRIMARY KEY,
          activeViewId TEXT
        )
      `).run();

      const defaultView = this.db.prepare(`SELECT * FROM views WHERE id = 'default-view'`).get();
      if (!defaultView) {
        const now = new Date().toISOString();
        this.db.prepare(`
          INSERT INTO views (id, name, description, createdAt, filters, visibleColumns, searchTerm, isDefault)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            'default-view',
            'All Services',
            'Default view showing all services',
            now,
            JSON.stringify({}),
            JSON.stringify({}),
            '',
            1
        );

        this.db.prepare(`
          INSERT OR REPLACE INTO view_preferences (id, activeViewId) VALUES (1, 'default-view')
        `).run();
      }
    });
  }
}
