import { AuditLogRepository } from '../../dal/auditLogRepository';
import { AuditLog } from '@OpsiMate/shared';

export class AuditBL {
	constructor(private auditLogRepository: AuditLogRepository) {}

	async logAction(params: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
		await this.auditLogRepository.insertAuditLog(params);
	}

	// For use inside a synchronous DB transaction, so the audit row is written (or
	// rolled back) together with the change it records.
	logActionInTransaction(params: Omit<AuditLog, 'id' | 'timestamp'>): void {
		this.auditLogRepository.insertAuditLogSync(params);
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
