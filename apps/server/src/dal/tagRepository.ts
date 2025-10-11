import Database, {Statement} from 'better-sqlite3';
import {Tag} from '@OpsiMate/shared';
import {runAsync} from './db.js';

export class TagRepository {
    constructor(private db: Database.Database) {
    }

    async createTag(data: Omit<Tag, 'id' | 'createdAt'>): Promise<{ lastID: number }> {
        return runAsync(() => {
            const stmt = this.db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)');
            const result = stmt.run(data.name, data.color);
            return {lastID: result.lastInsertRowid as number};
        });
    }

    async getAllTags(): Promise<Tag[]> {
        return runAsync(() => {
            const stmt: Statement<Tag[]> = this.db.prepare('SELECT id, name, color, created_at as createdAt FROM tags ORDER BY name');
            return stmt.all() as Tag[];
        });
    }

    async getTagById(id: number): Promise<Tag> {
        return runAsync(() => {
            const stmt = this.db.prepare('SELECT id, name, color, created_at as createdAt FROM tags WHERE id = ?');
            return stmt.get(id) as Tag;
        });
    }

    async updateTag(id: number, data: Partial<Omit<Tag, 'id' | 'createdAt'>>): Promise<void> {
        return runAsync(() => {
            const updates: string[] = [];
            const values: unknown[] = [];

            if (data.name !== undefined) {
                updates.push('name = ?');
                values.push(data.name);
            }
            if (data.color !== undefined) {
                updates.push('color = ?');
                values.push(data.color);
            }

            if (updates.length === 0) return;

            values.push(id);
            const query = `UPDATE tags
                           SET ${updates.join(', ')}
                           WHERE id = ?`;
            this.db.prepare(query).run(...values);
        });
    }

    async deleteTag(id: number): Promise<void> {
        return runAsync(() => {
            this.db.prepare('DELETE FROM tags WHERE id = ?').run(id);
        });
    }

    async addTagToService(serviceId: number, tagId: number): Promise<void> {
        return runAsync(() => {
            this.db.prepare('INSERT OR IGNORE INTO service_tags (service_id, tag_id) VALUES (?, ?)').run(serviceId, tagId);
        });
    }

    async removeTagFromService(serviceId: number, tagId: number): Promise<void> {
        return runAsync(() => {
            this.db.prepare('DELETE FROM service_tags WHERE service_id = ? AND tag_id = ?').run(serviceId, tagId);
        });
    }

    async getServiceTags(serviceId: number): Promise<Tag[]> {
        return runAsync(() => {
            const query = `
                SELECT t.id as id, t.name as name, t.color as color, t.created_at as createdAt
                FROM tags t
                         JOIN service_tags st ON t.id = st.tag_id
                WHERE st.service_id = ?
                ORDER BY t.name
            `;
            return this.db.prepare(query).all(serviceId) as Tag[];
        });
    }

    async initTagsTables(): Promise<void> {
        return runAsync(() => {
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS tags
                (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    name       TEXT NOT NULL UNIQUE,
                    color      TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();

            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS service_tags
                (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    service_id INTEGER NOT NULL,
                    tag_id     INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (service_id, tag_id),
                    FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
                    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
                )
            `).run();
        });
    }
}
