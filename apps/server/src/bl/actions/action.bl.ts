import {
	Action,
	AlertHistoryEventType,
	ActionOverrides,
	ActionPreview,
	ActionTestResult,
	AuditActionType,
	AuditResourceType,
	Logger,
	User,
} from '@OpsiMate/shared';
import { ActionRepository, CreateActionInput, UpdateActionInput } from '../../dal/actionRepository';
import { AlertHistoryRepository } from '../../dal/alertHistoryRepository';
import { AuditBL } from '../audit/audit.bl';
import {
	AlertContextInput,
	buildAlertContext,
	buildSampleContext,
	executeAction,
	ExecutableAction,
	previewAction,
} from './actionExecutor';

const logger = new Logger('bl/action.bl');

const API_TOKEN_ACTOR_ID = 0;
const API_TOKEN_ACTOR_NAME = 'API Token';

export class ActionBL {
	constructor(
		private actionRepo: ActionRepository,
		private auditBL: AuditBL,
		private alertHistoryRepo?: AlertHistoryRepository
	) {}

	async test(data: ExecutableAction): Promise<ActionTestResult> {
		return executeAction(data, buildSampleContext());
	}

	previewForAlert(action: Action, alert: AlertContextInput): ActionPreview {
		return previewAction({ name: action.name, type: action.type, config: action.config }, buildAlertContext(alert));
	}

	async runOnAlert(
		action: Action,
		alert: AlertContextInput,
		overrides?: ActionOverrides,
		actorName?: string | null
	): Promise<ActionTestResult> {
		const result = await executeAction(
			{ name: action.name, type: action.type, config: action.config },
			buildAlertContext(alert),
			overrides
		);

		// Record the run on the alert's history timeline (best-effort; never block the action).
		if (alert.id && this.alertHistoryRepo) {
			try {
				await this.alertHistoryRepo.recordEvent({
					alertId: alert.id,
					eventType: AlertHistoryEventType.ACTION_RUN,
					actorName,
					description: `Ran action "${action.name}"`,
				});
			} catch {
				// Swallow: history logging must not affect the action result.
			}
		}

		return result;
	}

	async create(data: CreateActionInput, actor?: User | null): Promise<Action> {
		const { lastID } = await this.actionRepo.createAction(data);
		const created = await this.actionRepo.getActionById(lastID);
		if (!created) {
			throw new Error('Failed to retrieve created action');
		}
		await this.recordAuditAction(AuditActionType.CREATE, created, actor);
		return created;
	}

	async list(): Promise<Action[]> {
		return this.actionRepo.getAllActions();
	}

	async get(id: number): Promise<Action | undefined> {
		return this.actionRepo.getActionById(id);
	}

	async update(id: number, data: UpdateActionInput, actor?: User | null): Promise<Action | undefined> {
		await this.actionRepo.updateAction(id, data);
		const updated = await this.actionRepo.getActionById(id);
		if (updated) {
			await this.recordAuditAction(AuditActionType.UPDATE, updated, actor, JSON.stringify(data));
		}
		return updated;
	}

	async delete(id: number, actor?: User | null): Promise<void> {
		const existing = await this.actionRepo.getActionById(id);
		await this.actionRepo.deleteAction(id);
		if (existing) {
			await this.recordAuditAction(AuditActionType.DELETE, existing, actor);
		}
	}

	private getAuditActor(actor?: User | null): { userId: number; userName: string } {
		const parsedUserId = actor?.id !== undefined ? Number(actor.id) : NaN;
		return {
			userId: Number.isFinite(parsedUserId) ? parsedUserId : API_TOKEN_ACTOR_ID,
			userName: actor?.fullName ?? API_TOKEN_ACTOR_NAME,
		};
	}

	private async recordAuditAction(
		actionType: AuditActionType,
		action: Action,
		actor?: User | null,
		details?: string
	): Promise<void> {
		try {
			const auditActor = this.getAuditActor(actor);
			await this.auditBL.logAction({
				actionType,
				resourceType: AuditResourceType.ACTION,
				resourceId: String(action.id),
				userId: auditActor.userId,
				userName: auditActor.userName,
				resourceName: action.name,
				details,
			});
		} catch (error) {
			logger.error(`Failed to record action audit event (${actionType}) for ${action.id}`, error);
		}
	}
}
