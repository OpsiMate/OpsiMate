import { ActionTarget, CustomAction } from '@OpsiMate/custom-actions';
import { Zap } from 'lucide-react';
import { ActionCard } from '../ActionCard';
import { ACTION_TARGET_LABELS } from '../actions.constants';

interface ActionCategoryProps {
	target: Exclude<ActionTarget, null>;
	actions: CustomAction[];
	onEdit: (action: CustomAction) => void;
	onDelete: (action: CustomAction) => void;
	onPlay?: (action: CustomAction) => void;
}

export const ActionCategory = ({ target, actions, onEdit, onDelete, onPlay }: ActionCategoryProps) => {
	const iconContainerClass =
		target === 'service'
			? 'bg-blue-50 border border-blue-300 text-blue-500'
			: 'bg-purple-50 border border-purple-300 text-purple-500';

	return (
		<div className="space-y-4">
			<h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
				<div className={`flex items-center justify-center h-6 w-6 rounded-md ${iconContainerClass}`}>
					<Zap className="h-[14px] w-[14px]" />
				</div>
				{ACTION_TARGET_LABELS[target]}
			</h2>
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
				{actions.map((action: CustomAction) => (
					<ActionCard
						key={action.id}
						action={action}
						onClick={() => onEdit(action)}
						onDelete={(e) => {
							e.stopPropagation();
							onDelete(action);
						}}
						onPlay={
							onPlay
								? (e) => {
										e.stopPropagation();
										onPlay(action);
									}
								: undefined
						}
					/>
				))}
			</div>
		</div>
	);
};
