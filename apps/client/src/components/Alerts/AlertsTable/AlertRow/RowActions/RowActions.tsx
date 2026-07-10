import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert } from '@OpsiMate/shared';
import { BellOff, Book, CheckCircle2, ExternalLink, Flame, MoreVertical, RotateCcw, Trash2 } from 'lucide-react';

export interface RowActionsProps {
	alert: Alert;
	onSilenceAlert?: (alertId: string) => void;
	onUnsilenceAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
	onUnresolveAlert?: (alertId: string) => void;
}

// All row actions live in the three-dots menu — no standalone quick buttons.
export const RowActions = ({
	alert,
	onSilenceAlert,
	onUnsilenceAlert,
	onDeleteAlert,
	onUnresolveAlert,
}: RowActionsProps) => {
	const { alertUrl, runbookUrl, isSilenced } = alert;
	// In the combined "All" view a row carries a transient isResolved flag so it can present
	// resolved behaviour (permanent delete, no silence/resolve) even though the table-level
	// callbacks are shared across active and resolved rows.
	const isResolvedAlert = Boolean(alert.isResolved);
	const isActive = !isResolvedAlert && Boolean(onSilenceAlert);
	const canToggleSilence =
		!isResolvedAlert && ((!isSilenced && Boolean(onSilenceAlert)) || (isSilenced && Boolean(onUnsilenceAlert)));
	// Only resolved rows can be moved back to firing (isActive is false on the Resolved tab
	// and on resolved rows in the All view).
	const canUnresolve = !isActive && Boolean(onUnresolveAlert);
	const hasActions = Boolean(alertUrl || runbookUrl || onDeleteAlert || canToggleSilence || canUnresolve);

	const handleToggleSilence = (event: React.MouseEvent) => {
		event.stopPropagation();
		if (isSilenced) {
			onUnsilenceAlert?.(alert.id);
		} else {
			onSilenceAlert?.(alert.id);
		}
	};

	const handleOpenLink = (url: string) => {
		window.open(url, '_blank', 'noopener,noreferrer');
	};

	const handleDelete = (event: React.MouseEvent) => {
		event.stopPropagation();
		onDeleteAlert?.(alert.id);
	};

	const handleUnresolve = (event: React.MouseEvent) => {
		event.stopPropagation();
		onUnresolveAlert?.(alert.id);
	};

	if (!hasActions) return null;

	return (
		<div className="flex items-center justify-end gap-1.5">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 rounded-full text-foreground hover:bg-muted hover:text-foreground"
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
							<Book className="mr-2 h-3 w-3" />
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
					{(runbookUrl || alertUrl) && (onDeleteAlert || canToggleSilence || canUnresolve) && (
						<DropdownMenuSeparator />
					)}
					{canUnresolve && (
						<DropdownMenuItem onClick={handleUnresolve}>
							<Flame className="mr-2 h-3 w-3" />
							Unresolve
						</DropdownMenuItem>
					)}
					{onDeleteAlert && (
						<DropdownMenuItem
							onClick={handleDelete}
							className={isActive ? '' : 'text-destructive focus:text-destructive'}
						>
							{isActive ? (
								<>
									<CheckCircle2 className="mr-2 h-3 w-3" />
									Resolve
								</>
							) : (
								<>
									<Trash2 className="mr-2 h-3 w-3" />
									Delete
								</>
							)}
						</DropdownMenuItem>
					)}
					{canToggleSilence && (
						<DropdownMenuItem onClick={handleToggleSilence}>
							{isSilenced ? (
								<>
									<RotateCcw className="mr-2 h-3 w-3" />
									Unsilence
								</>
							) : (
								<>
									<BellOff className="mr-2 h-3 w-3" />
									Silence
								</>
							)}
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
