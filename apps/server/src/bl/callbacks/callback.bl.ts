import { randomBytes } from 'node:crypto';
import {
	AlertCallback,
	AlertCallbackTestResult,
	AlertCallbackWithSecret,
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

// What create takes: the secret is optional (generated when omitted).
export interface CreateCallbackData extends Omit<CreateAlertCallbackInput, 'secret'> {
	secret?: string;
}

export const generateCallbackSecret = (): string => randomBytes(24).toString('hex');

// What an edit writes to the audit log: never the secret, and only the NAMES of headers
// (a header value is typically the receiver's auth token).
export const auditableChanges = (data: UpdateAlertCallbackInput): Record<string, unknown> => {
	const { secret, headers, ...rest } = data;
	const changes: Record<string, unknown> = { ...rest };
	if (secret !== undefined) changes.secret = '[rotated]';
	if (headers !== undefined) changes.headers = headers ? Object.keys(headers) : null;
	return changes;
};

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

	// The only responses that carry the secret are this one and a rotation: the admin
	// has to copy it into the receiver, and afterwards it is never shown again.
	async create(data: CreateCallbackData, actor?: User | null): Promise<AlertCallbackWithSecret> {
		const { lastID } = await this.callbackRepo.createAlertCallback({
			...data,
			secret: data.secret ?? generateCallbackSecret(),
		});
		const created = await this.callbackRepo.getAlertCallbackWithSecret(lastID);
		if (!created) throw new Error('Failed to retrieve created callback');
		await this.dispatcher.reload();
		await this.recordAudit(AuditActionType.CREATE, created, actor);
		return created;
	}

	async update(
		id: number,
		data: UpdateAlertCallbackInput,
		actor?: User | null
	): Promise<AlertCallback | AlertCallbackWithSecret | undefined> {
		await this.callbackRepo.updateAlertCallback(id, data);
		const updated =
			data.secret !== undefined
				? await this.callbackRepo.getAlertCallbackWithSecret(id)
				: await this.callbackRepo.getAlertCallbackById(id);
		if (updated) {
			await this.dispatcher.reload();
			await this.recordAudit(AuditActionType.UPDATE, updated, actor, JSON.stringify(auditableChanges(data)));
		}
		return updated;
	}

	async delete(id: number, actor?: User | null): Promise<void> {
		const existing = await this.callbackRepo.getAlertCallbackById(id);
		await this.callbackRepo.deleteAlertCallback(id);
		await this.dispatcher.reload();
		if (existing) await this.recordAudit(AuditActionType.DELETE, existing, actor);
	}

	// A typed secret signs the test; otherwise the saved secret of `callbackId` does (the
	// page never sees that one again, so it cannot send it). Undefined = no such callback.
	async test(target: CallbackTarget, callbackId?: number): Promise<AlertCallbackTestResult | undefined> {
		if (!target.secret && callbackId !== undefined) {
			const stored = await this.callbackRepo.getAlertCallbackWithSecret(callbackId);
			if (!stored) return undefined;
			return this.dispatcher.test({ ...target, secret: stored.secret });
		}
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
