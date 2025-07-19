import Database from 'better-sqlite3';
import { runAsync } from './db';
import { AuditLog } from '@service-peek/shared';
import {EnrichedAuditLogRow} from './models';

export class AuditLogRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    async initAuditLogsTable(): Promise<void> {
        return runAsync(() => {
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action_type TEXT NOT NULL,
                    resource_type TEXT NOT NULL,
                    resource_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    details TEXT
                )
            `).run();
        });
    }

    async insertAuditLog(log: Omit<AuditLog, 'id' | 'timestamp' | 'userName' | 'resourceName'>): Promise<{ lastID: number }> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                INSERT INTO audit_logs (action_type, resource_type, resource_id, user_id, details)
                VALUES (?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                log.actionType as string,
                log.resourceType as string,
                log.resourceId,
                log.userId,
                log.details || null
            );
            return { lastID: result.lastInsertRowid as number };
        });
    }

    async getAuditLogs(offset: number, limit: number): Promise<AuditLog[]> {
        return runAsync(() => {
            const rows = this.db.prepare(`
                SELECT a.*, u.full_name as user_name,
                  CASE 
                    WHEN a.resource_type = 'PROVIDER' THEN (SELECT provider_name FROM providers WHERE id = a.resource_id)
                    WHEN a.resource_type = 'SERVICE' THEN (SELECT service_name FROM services WHERE id = a.resource_id)
                    WHEN a.resource_type = 'USER' THEN (SELECT full_name FROM users WHERE id = a.resource_id)
                    ELSE NULL
                  END as resource_name
                FROM audit_logs a
                LEFT JOIN users u ON a.user_id = u.id
                ORDER BY a.timestamp DESC
                LIMIT ? OFFSET ?
            `).all(limit, offset) as EnrichedAuditLogRow[];
            return rows.map(row => ({
                id: row.id,
                actionType: row.action_type,
                resourceType: row.resource_type,
                resourceId: row.resource_id,
                userId: row.user_id,
                userName: row.user_name,
                resourceName: row.resource_name,
                timestamp: row.timestamp,
                details: row.details,
            }));
        });
    }

    async countAuditLogs(): Promise<number> {
        return runAsync(() => {
            const stmt = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs');
            const row = stmt.get() as { count: number };
            return row.count;
        });
    }
} 