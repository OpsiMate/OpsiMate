import Database from 'better-sqlite3';
import { runAsync } from './db';
import { AuditLog } from '@OpsiMate/shared';
import { AuditLogRow } from './models';

export class AuditLogRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async initAuditLogsTable(): Promise<void> {
		return runAsync(() => {
			this.db
				.prepare(
					`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action_type TEXT NOT NULL,
                    resource_type TEXT NOT NULL,
                    resource_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    user_name TEXT,
                    resource_name TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    details TEXT,
                    role TEXT,
                    created_by TEXT
                )
            `
				)
				.run();
		});
	}

    async insertAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<{ lastID: number }> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                INSERT INTO audit_logs (action_type, resource_type, resource_id, user_id, user_name, resource_name, details, role, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                log.actionType as string,
                log.resourceType as string,
                log.resourceId,
                log.userId,
                log.userName,
                log.resourceName,
                log.details || null,
                log.role || null,
                log.createdBy || null
            );
            return { lastID: result.lastInsertRowid as number };
        });
    }

	async getAuditLogs(offset: number, limit: number): Promise<AuditLog[]> {
		return runAsync(() => {
			const rows = this.db
				.prepare(
					`
                SELECT * FROM audit_logs
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            `
				)
				.all(limit, offset) as AuditLogRow[];
			return rows.map((row) => ({
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
