import Database from 'better-sqlite3';
import { ServiceCustomFieldValue } from '@OpsiMate/shared';
import { runAsync } from "./db";

export class ServiceCustomFieldValueRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    async upsertCustomFieldValue(serviceId: number, customFieldId: number, value: string): Promise<void> {
        return await runAsync<void>(() => {
            const stmt = this.db.prepare(`
                INSERT INTO service_custom_field_value (service_id, custom_field_id, value, created_at, updated_at)
                VALUES (?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(service_id, custom_field_id)
                DO UPDATE SET
                    value = excluded.value,
                    updated_at = datetime('now')
            `);

            stmt.run(serviceId, customFieldId, value);
        });
    }

    async getCustomFieldValuesByServiceId(serviceId: number): Promise<ServiceCustomFieldValue[]> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT service_id AS serviceId,
                       custom_field_id AS customFieldId,
                       value,
                       created_at AS createdAt,
                       updated_at AS updatedAt
                FROM service_custom_field_value
                WHERE service_id = ?
            `);
            return stmt.all(serviceId) as ServiceCustomFieldValue[];
        });
    }

    async getCustomFieldValue(serviceId: number, customFieldId: number): Promise<ServiceCustomFieldValue | null> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT service_id AS serviceId,
                       custom_field_id AS customFieldId,
                       value,
                       created_at AS createdAt,
                       updated_at AS updatedAt
                FROM service_custom_field_value
                WHERE service_id = ? AND custom_field_id = ?
            `);
            const result = stmt.get(serviceId, customFieldId) as ServiceCustomFieldValue | undefined;
            return result || null;
        });
    }

    async getAllCustomFieldValues(): Promise<ServiceCustomFieldValue[]> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT service_id AS serviceId,
                       custom_field_id AS customFieldId,
                       value,
                       created_at AS createdAt,
                       updated_at AS updatedAt
                FROM service_custom_field_value
                ORDER BY service_id, custom_field_id
            `);
            return stmt.all() as ServiceCustomFieldValue[];
        });
    }

    async deleteCustomFieldValue(serviceId: number, customFieldId: number): Promise<boolean> {
        return await runAsync<boolean>(() => {
            const deleteStmt = this.db.prepare(
                'DELETE FROM service_custom_field_value WHERE service_id = ? AND custom_field_id = ?'
            );
            const result = deleteStmt.run(serviceId, customFieldId);
            return result.changes > 0;
        });
    }

    async deleteAllValuesForCustomField(customFieldId: number): Promise<number> {
        return await runAsync<number>(() => {
            const deleteStmt = this.db.prepare(
                'DELETE FROM service_custom_field_value WHERE custom_field_id = ?'
            );
            const result = deleteStmt.run(customFieldId);
            return result.changes;
        });
    }

    async deleteAllValuesForService(serviceId: number): Promise<number> {
        return await runAsync<number>(() => {
            const deleteStmt = this.db.prepare(
                'DELETE FROM service_custom_field_value WHERE service_id = ?'
            );
            const result = deleteStmt.run(serviceId);
            return result.changes;
        });
    }

    async initServiceCustomFieldValueTable(): Promise<void> {
        return runAsync(() => {
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS service_custom_field_value (
                    service_id INTEGER NOT NULL,
                    custom_field_id INTEGER NOT NULL,
                    value TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (service_id, custom_field_id),
                    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
                    FOREIGN KEY (custom_field_id) REFERENCES service_custom_field(id) ON DELETE CASCADE
                )
            `).run();
        });
    }
}
