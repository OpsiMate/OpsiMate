import {AuditLogJobData, AuditLogRepository} from '../../dal/auditLogRepository';
import { AuditLog } from '@OpsiMate/shared';

export class AuditBL {
    constructor(private auditLogRepository: AuditLogRepository) {}

      logAction(params: AuditLogJobData) {
        this.auditLogRepository.insertAuditLog(params);
    }

    async getAuditLogsPaginated(page: number, pageSize: number): Promise<{ logs: AuditLog[]; total: number }> {
        const offset = (page - 1) * pageSize;
        const [logs, total] = await Promise.all([
            this.auditLogRepository.getAuditLogs(offset, pageSize),
            this.auditLogRepository.countAuditLogs(),
        ]);
        return { logs, total };
    }
} 