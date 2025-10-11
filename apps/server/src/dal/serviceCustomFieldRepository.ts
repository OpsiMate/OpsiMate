import Database from 'better-sqlite3';
import { ServiceCustomField } from '@OpsiMate/shared';
import { runAsync } from "./db.js";

export class ServiceCustomFieldRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    async createCustomField(data: Omit<ServiceCustomField, 'id' | 'createdAt'>): Promise<{ lastID: number }> {
        return await runAsync<{ lastID: number }>(() => {
            const stmt = this.db.prepare(
                'INSERT INTO service_custom_field (name, created_at) VALUES (?, datetime(\'now\'))'
            );

            const result = stmt.run(data.name);
            return { lastID: result.lastInsertRowid as number };
        });
    }

    async getCustomFields(): Promise<ServiceCustomField[]> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT id,
                       name,
                       created_at AS createdAt
                FROM service_custom_field
                ORDER BY created_at DESC
            `);
            return stmt.all() as ServiceCustomField[];
        });
    }

    async getCustomFieldById(id: number): Promise<ServiceCustomField | null> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT id,
                       name,
                       created_at AS createdAt
                FROM service_custom_field
                WHERE id = ?
            `);
            const result = stmt.get(id) as ServiceCustomField | undefined;
            return result || null;
        });
    }

    async updateCustomField(id: number, data: Partial<Pick<ServiceCustomField, 'name'>>): Promise<boolean> {
        return await runAsync<boolean>(() => {
            const updateFields: string[] = [];
            const values: (string | number)[] = [];

            if (data.name !== undefined) {
                updateFields.push('name = ?');
                values.push(data.name);
            }

            if (updateFields.length === 0) {
                return false;
            }

            const stmt = this.db.prepare(
                `UPDATE service_custom_field SET ${updateFields.join(', ')} WHERE id = ?`
            );

            const result = stmt.run(...values, id);
            return result.changes > 0;
        });
    }

    async deleteCustomField(id: number): Promise<boolean> {
        return await runAsync<boolean>(() => {
            const deleteStmt = this.db.prepare('DELETE FROM service_custom_field WHERE id = ?');
            const result = deleteStmt.run(id);

            return result.changes > 0;
        });
    }

    async initServiceCustomFieldTable(): Promise<void> {
        return runAsync(() => {
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS service_custom_field (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();
        });
    }
}
