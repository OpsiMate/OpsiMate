import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert } from '@OpsiMate/shared';
import { ExternalLink, MoreVertical, RotateCcw, Trash2, X } from 'lucide-react';

export interface RowActionsProps {
	alert: Alert;
	onDismissAlert?: (alertId: string) => void;
	onUndismissAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
}

export const RowActions = ({ alert, onDismissAlert, onUndismissAlert, onDeleteAlert }: RowActionsProps) => {
	const { alertUrl, runbookUrl, isDismissed } = alert;
	const hasLinks = Boolean(alertUrl || runbookUrl);
	const canToggle = (!isDismissed && Boolean(onDismissAlert)) || (isDismissed && Boolean(onUndismissAlert));

	const handleToggle = (event: React.MouseEvent) => {
		event.stopPropagation();
		if (isDismissed) {
			onUndismissAlert?.(alert.id);
		} else {
			onDismissAlert?.(alert.id);
		}
	};

	const handleOpenLink = (url: string) => {
		window.open(url, '_blank', 'noopener,noreferrer');
	};

	const handleDelete = (event: React.MouseEvent) => {
		event.stopPropagation();
		onDeleteAlert?.(alert.id);
	};

	return (
		<div className="flex items-center justify-end gap-1.5">
			{hasLinks && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 rounded-full"
							onClick={(event) => event.stopPropagation()}
							title="More actions"
						>
							<MoreVertical className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{runbookUrl && (
							<DropdownMenuItem
								onClick={(event) => {
									event.stopPropagation();
									handleOpenLink(runbookUrl);
								}}
							>
								<span className="mr-2">📖</span>
								Runbook
							</DropdownMenuItem>
						)}
						{alertUrl && (
							<DropdownMenuItem
								onClick={(event) => {
									event.stopPropagation();
									handleOpenLink(alertUrl);
								}}
							>
								<ExternalLink className="mr-2 h-3 w-3" />
								Source
							</DropdownMenuItem>
						)}
						{(runbookUrl || alertUrl) && onDeleteAlert && <DropdownMenuSeparator />}
						{onDeleteAlert && (
							<DropdownMenuItem
								onClick={handleDelete}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="mr-2 h-3 w-3" />
								Delete
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			{canToggle && (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={handleToggle}
					className="h-6 w-6 rounded-full text-muted-foreground hover:text-white hover:bg-primary transition-colors"
					title={isDismissed ? 'Undismiss alert' : 'Dismiss alert'}
					aria-label={isDismissed ? 'Undismiss alert' : 'Dismiss alert'}
					aria-pressed={isDismissed}
				>
					{isDismissed ? <RotateCcw className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
				</Button>
			)}
		</div>
	);
};
