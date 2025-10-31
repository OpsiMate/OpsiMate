import { CustomAction } from '@OpsiMate/custom-actions';
import { ACTION_TARGET_COLORS, ACTION_TYPE_ICONS } from '../actions.constants';
import { cn } from '@/lib/utils';
import { Zap, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActionCardProps {
	action: CustomAction;
	onClick: () => void;
	onDelete?: (e: React.MouseEvent) => void;
}

export const ActionCard = ({ action, onClick, onDelete }: ActionCardProps) => {
	const targetColor = ACTION_TARGET_COLORS[action.target ?? null];
	const typeIcon = ACTION_TYPE_ICONS[action.type];

	return (
		<div className="relative group">
			<button
				onClick={onClick}
				className={cn(
					'w-full flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-300 cursor-pointer min-h-[100px]',
					'hover:scale-105 hover:shadow-md',
					'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
					targetColor
				)}
			>
				<div className="flex flex-col items-center gap-2">
					<div className="relative">
						<Zap className="h-6 w-6 text-primary" />
						<span className="absolute -top-0.5 -right-0.5 text-xs">{typeIcon}</span>
					</div>
					<div className="text-center">
						<h3 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
							{action.name}
						</h3>
					</div>
				</div>
			</button>
			{onDelete && (
				<Button
					variant="ghost"
					size="icon"
					className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
					onClick={onDelete}
				>
					<Trash2 className="h-3 w-3" />
				</Button>
			)}
		</div>
	);
};
