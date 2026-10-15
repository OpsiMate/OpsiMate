import { randomBytes } from 'node:crypto';
import {
	AlertCallback,
	AlertCallbackTestResult,
	AuditActionType,
	AuditResourceType,
	Logger,
	User,
} from '@OpsiMate/shared';
import {
	AlertCallbackRepository,
	CreateAlertCallbackInput,
	UpdateAlertCallbackInput,
} from '../../dal/alertCallbackRepository';
import { AuditBL } from '../audit/audit.bl';
import { CallbackDispatcher, CallbackTarget } from './callbackDispatcher';

const logger = new Logger('bl/callbacks/callback.bl');

const API_TOKEN_ACTOR_ID = 0;
const API_TOKEN_ACTOR_NAME = 'API Token';

export type CreateCallbackData = Omit<CreateAlertCallbackInput, 'secret'> & { secret?: string };

export const generateCallbackSecret = (): string => randomBytes(24).toString('hex');

export class CallbackBL {
	constructor(
		private callbackRepo: AlertCallbackRepository,
		private auditBL: AuditBL,
		private dispatcher: CallbackDispatcher
	) {}

	async list(): Promise<AlertCallback[]> {
		return this.callbackRepo.getAllAlertCallbacks();
	}

	async get(id: number): Promise<AlertCallback | undefined> {
		return this.callbackRepo.getAlertCallbackById(id);
	}

	async create(data: CreateCallbackData, actor?: User | null): Promise<AlertCallback> {
		const { lastID } = await this.callbackRepo.createAlertCallback({
			...data,
			secret: data.secret ?? generateCallbackSecret(),
		});
		const created = await this.callbackRepo.getAlertCallbackById(lastID);
		if (!created) throw new Error('Failed to retrieve created callback');
		await this.dispatcher.reload();
		await this.recordAudit(AuditActionType.CREATE, created, actor);
		return created;
	}

	async update(id: number, data: UpdateAlertCallbackInput, actor?: User | null): Promise<AlertCallback | undefined> {
		await this.callbackRepo.updateAlertCallback(id, data);
		const updated = await this.callbackRepo.getAlertCallbackById(id);
		if (updated) {
			await this.dispatcher.reload();
			// The secret is the one value that must not land in the audit log.
			const { secret: _secret, ...loggable } = data;
			await this.recordAudit(AuditActionType.UPDATE, updated, actor, JSON.stringify(loggable));
		}
		return updated;
	}

	async delete(id: number, actor?: User | null): Promise<void> {
		const existing = await this.callbackRepo.getAlertCallbackById(id);
		await this.callbackRepo.deleteAlertCallback(id);
		await this.dispatcher.reload();
		if (existing) await this.recordAudit(AuditActionType.DELETE, existing, actor);
	}

	async test(target: CallbackTarget): Promise<AlertCallbackTestResult> {
		return this.dispatcher.test(target);
	}

	private async recordAudit(
		actionType: AuditActionType,
		callback: AlertCallback,
		actor?: User | null,
		details?: string
	): Promise<void> {
		try {
			const parsedUserId = actor?.id !== undefined ? Number(actor.id) : NaN;
			await this.auditBL.logAction({
				actionType,
				resourceType: AuditResourceType.CALLBACK,
				resourceId: String(callback.id),
				userId: Number.isFinite(parsedUserId) ? parsedUserId : API_TOKEN_ACTOR_ID,
				userName: actor?.fullName ?? API_TOKEN_ACTOR_NAME,
				resourceName: callback.name,
				details,
			});
		} catch (error) {
			logger.error(`Failed to record callback audit event (${actionType}) for ${callback.id}`, error);
		}
	}
}
