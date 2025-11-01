import { ActionTarget, CustomAction } from '@OpsiMate/custom-actions';
import { ActionCategory } from '../ActionCategory';
import { groupActionsByTarget } from '../actions.utils';

interface ActionCategoriesProps {
	actions: CustomAction[];
	targetOrder: Array<Exclude<ActionTarget, null>>;
	onEdit: (action: CustomAction) => void;
	onDelete: (action: CustomAction) => void;
}

export const ActionCategories = ({ actions, targetOrder, onEdit, onDelete }: ActionCategoriesProps) => {
	const groupedActions = groupActionsByTarget(actions);

	return (
		<div className="flex flex-col gap-8">
			{targetOrder
				.filter((target) => groupedActions[target].length > 0)
				.map((target: ActionTarget, index: number) => (
					<ActionCategory
						key={`${target}-${index}`}
						target={target}
						actions={groupedActions[target]}
						onEdit={onEdit}
						onDelete={onDelete}
					/>
				))}
		</div>
	);
};
