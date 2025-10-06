import Database from 'better-sqlite3';
import { runAsync } from './db';
import { AuditLog } from '@OpsiMate/shared';
import { AuditLogRow } from './models';
import { AsyncQueue } from '../jobs/asyncQueue';

export type AuditLogJobData = Omit<AuditLog, 'id' | 'timestamp'>;

function processAuditLogJobData(db: Database.Database) {
  return async function (jobs: AuditLogJobData[]) {
    return runAsync(() => {
      if (jobs.length === 0) return;

      const placeholders = jobs.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const sqlQuery = `INSERT INTO audit_logs (action_type, resource_type, resource_id, user_id, user_name, resource_name, details) VALUES ${placeholders}`;

      const params: (string | number | null | undefined)[] = [];
      for (const job of jobs) {
        params.push(
          job.actionType,
          job.resourceType,
          job.resourceId,
          job.userId,
          job.userName,
          job.resourceName,
          job.details
        );
      }

      const stmt = db.prepare(sqlQuery);
      stmt.run(params);
    });
  };
}

export class AuditLogRepository {
  private db: Database.Database;
  private auditLogQueue: AsyncQueue<AuditLogJobData>;

  constructor(db: Database.Database) {
    this.db = db;
    this.auditLogQueue = new AsyncQueue(processAuditLogJobData(db), {
      queueName: 'auditLogs',
      retryAttempts: 3,
    });
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
                    details TEXT
                )
            `
        )
        .run();
    });
  }

  insertAuditLog(log: AuditLogJobData) {
    void this.auditLogQueue.add(log);
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
