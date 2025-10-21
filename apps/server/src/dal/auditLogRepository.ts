import Database from 'better-sqlite3';
import { runAsync } from './db.js';
import { AuditLog } from '@OpsiMate/shared';
import { AuditLogRow } from './models.js';

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
                    user_name TEXT,
                    resource_name TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    details TEXT
                )
            `).run();
        });
    }

    async insertAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<{ lastID: number }> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                INSERT INTO audit_logs (action_type, resource_type, resource_id, user_id, user_name, resource_name, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                log.actionType as string,
                log.resourceType as string,
                log.resourceId,
                log.userId,
                log.userName,
                log.resourceName,
                log.details || null
            );
            return { lastID: result.lastInsertRowid as number };
        });
    }

    private buildWhereClause( filters: {userName?: string; actionType?: string; resourceType?: string; resourceName?: string}) {
       const where: string[] = [];
       const params: unknown[] = [];
    
       if(filters.userName || filters.resourceName){
           const searchQuery = filters.userName || filters.resourceName;
            where.push('(LOWER(user_name) LIKE LOWER(?) OR LOWER(resource_name) LIKE LOWER(?))');
            params.push(`%${searchQuery}%`, `%${searchQuery}%`);
        }

       if (filters.actionType) {
            where.push('action_type = ?');
            params.push(filters.actionType);
        }

        if (filters.resourceType) {
            where.push('resource_type = ?');
            params.push(filters.resourceType);
        }

               const result = {
            clause: where.length ? `WHERE ${where.join(' AND ')}` : '',
            params,
        };


        return result;

    
    
    }
    
    async getAuditLogs(
    offset: number,
     limit: number,
      filters:{userName?: string; actionType?: string; resourceType?: string; resourceName?:string }): Promise<AuditLog[]> {
        return runAsync(() => {
            const { clause, params } = this.buildWhereClause(filters);
            const rows = this.db.prepare(`
                SELECT * FROM audit_logs
                ${clause}
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            `).all(...params,limit, offset) as AuditLogRow[];
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

    async countAuditLogs(
     filters: { userName?: string; actionType?: string; resourceType?: string; resourceName?: string }): Promise<number> {
        return runAsync(() => {
            const { clause,params } = this.buildWhereClause(filters);
            const stmt = this.db.prepare(`
            SELECT COUNT(*) as count FROM audit_logs
            ${clause}
            `);
            const row = stmt.get(...params) as { count: number };
            return row.count;
        });
    }
} 