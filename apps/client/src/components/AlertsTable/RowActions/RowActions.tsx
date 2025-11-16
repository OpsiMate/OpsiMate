import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert } from '@OpsiMate/shared';
import { ExternalLink, MoreVertical, RotateCcw, X } from 'lucide-react';
import { MouseEvent } from 'react';

export interface RowActionsProps {
	alert: Alert;
	onDismissAlert?: (alertId: string) => void;
	onUndismissAlert?: (alertId: string) => void;
}

export const RowActions = ({ alert, onDismissAlert, onUndismissAlert }: RowActionsProps) => {
	const { alertUrl, runbookUrl, isDismissed } = alert;
	const hasLinks = Boolean(alertUrl || runbookUrl);
	const canToggle = (!isDismissed && Boolean(onDismissAlert)) || (isDismissed && Boolean(onUndismissAlert));

	const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
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

	return (
		<div className="flex items-center justify-end gap-1.5">
			{hasLinks && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
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
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			{canToggle && (
				<Button
					variant="outline"
					size="icon"
					className="h-7 w-7"
					onClick={handleToggle}
					title={isDismissed ? 'Undismiss alert' : 'Dismiss alert'}
				>
					{isDismissed ? <RotateCcw className="h-3 w-3" /> : <X className="h-3 w-3" />}
				</Button>
			)}
		</div>
	);
};

