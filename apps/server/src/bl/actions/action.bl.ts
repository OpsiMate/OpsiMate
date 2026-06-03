import { Action, ActionOverrides, ActionPreview, ActionTestResult } from '@OpsiMate/shared';
import { ActionRepository, CreateActionInput, UpdateActionInput } from '../../dal/actionRepository';
import {
	AlertContextInput,
	buildAlertContext,
	buildSampleContext,
	executeAction,
	ExecutableAction,
	previewAction,
} from './actionExecutor';

export class ActionBL {
	constructor(private actionRepo: ActionRepository) {}

	async test(data: ExecutableAction): Promise<ActionTestResult> {
		return executeAction(data, buildSampleContext());
	}

	previewForAlert(action: Action, alert: AlertContextInput): ActionPreview {
		return previewAction(
			{ name: action.name, type: action.type, config: action.config },
			buildAlertContext(alert)
		);
	}

	async runOnAlert(action: Action, alert: AlertContextInput, overrides?: ActionOverrides): Promise<ActionTestResult> {
		return executeAction(
			{ name: action.name, type: action.type, config: action.config },
			buildAlertContext(alert),
			overrides
		);
	}

	async create(data: CreateActionInput): Promise<Action> {
		const { lastID } = await this.actionRepo.createAction(data);
		const created = await this.actionRepo.getActionById(lastID);
		if (!created) {
			throw new Error('Failed to retrieve created action');
		}
		return created;
	}

	async list(): Promise<Action[]> {
		return this.actionRepo.getAllActions();
	}

	async get(id: number): Promise<Action | undefined> {
		return this.actionRepo.getActionById(id);
	}

	async update(id: number, data: UpdateActionInput): Promise<Action | undefined> {
		await this.actionRepo.updateAction(id, data);
		return this.actionRepo.getActionById(id);
	}

	async delete(id: number): Promise<void> {
		await this.actionRepo.deleteAction(id);
	}
}
