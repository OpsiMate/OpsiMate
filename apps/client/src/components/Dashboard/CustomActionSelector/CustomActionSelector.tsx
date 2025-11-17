import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCustomActions } from '@/hooks/queries/custom-actions';
import { CustomAction } from '@OpsiMate/custom-actions';
import { Loader2, Zap } from 'lucide-react';

interface CustomActionSelectorProps {
	onSelectAction: (action: CustomAction) => void;
	disabled?: boolean;
	isRunning?: boolean;
}

export const CustomActionSelector = ({ onSelectAction, disabled, isRunning }: CustomActionSelectorProps) => {
	const { data: actions = [], isLoading } = useCustomActions();

	const serviceActions = actions.filter((action) => action.target === 'service');

	if (serviceActions.length === 0) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" disabled={disabled || isRunning} className="gap-2 h-9">
					{isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
					{isRunning ? 'Running...' : 'Actions'}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{isLoading ? (
					<DropdownMenuItem disabled>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Loading actions...
					</DropdownMenuItem>
				) : serviceActions.length === 0 ? (
					<DropdownMenuItem disabled>No actions available</DropdownMenuItem>
				) : (
					<>
						<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Service Actions</div>
						<DropdownMenuSeparator />
						{serviceActions.map((action) => (
							<DropdownMenuItem
								key={action.id}
								onClick={() => onSelectAction(action)}
								className="flex flex-col items-start gap-1"
							>
								<div className="font-medium">{action.name}</div>
								{action.description && (
									<div className="text-xs text-muted-foreground line-clamp-2">
										{action.description}
									</div>
								)}
							</DropdownMenuItem>
						))}
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
