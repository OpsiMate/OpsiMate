import { CustomAction, ActionTarget } from '@OpsiMate/custom-actions';

export const groupActionsByTarget = (actions: CustomAction[]): Record<ActionTarget, CustomAction[]> => {
	const grouped: Record<ActionTarget, CustomAction[]> = {
		service: [],
		provider: [],
		null: [],
	};

	actions.forEach((action) => {
		const target = action.target ?? null;
		grouped[target].push(action);
	});

	return grouped;
};
