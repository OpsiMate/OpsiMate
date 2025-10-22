import { AuditLogRepository } from '../../dal/auditLogRepository.js';
import { AuditLog } from '@OpsiMate/shared';

export class AuditBL {
    constructor(private auditLogRepository: AuditLogRepository) {}

    async logAction(params: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
        await this.auditLogRepository.insertAuditLog(params);
    }

    async getAuditLogsPaginated(
    page: number,
    pageSize: number,
    filters: {
        userName?: string; 
        actionType?: string; 
        resourceType?: string; 
        resourceName?: string;
        startTime?: string;
        endTime?: string;}): Promise<{ logs: AuditLog[]; total: number }> {
            const offset = (page - 1) * pageSize;
            const [logs, total] = await Promise.all([
                this.auditLogRepository.getAuditLogs(offset, pageSize, filters),
                this.auditLogRepository.countAuditLogs(filters),
            ]);
            return { logs, total };
    }
} 