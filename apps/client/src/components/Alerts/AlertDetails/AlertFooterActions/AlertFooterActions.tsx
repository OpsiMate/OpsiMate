import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AUTO_FIX_RESOLVE_REFUSED, isAutoFixed } from '@OpsiMate/shared';
import { BellOff, CheckCircle2, Flame, RotateCcw, Trash2 } from 'lucide-react';

interface AlertFooterActionsProps {
	alert: Alert;
	isActive: boolean;
	onSilence?: (alertId: string) => void;
	onUnsilence?: (alertId: string) => void;
	onDelete?: (alertId: string) => void;
	onUnresolve?: (alertId: string) => void;
}

// The alert's primary actions, pinned as a one-row footer at the bottom of the details
// panel (outside the scroll area) so they're always reachable.
export const AlertFooterActions = ({
	alert,
	isActive,
	onSilence,
	onUnsilence,
	onDelete,
	onUnresolve,
}: AlertFooterActionsProps) => {
	if (!isActive) {
		return (
			<div className="grid grid-cols-2 gap-2">
				<Button variant="outline" size="sm" className="gap-2" onClick={() => onUnresolve?.(alert.id)}>
					<Flame className="h-3 w-3" />
					Unresolve
				</Button>

				{onDelete && (
					<Button variant="destructive" size="sm" className="gap-2" onClick={() => onDelete(alert.id)}>
						<Trash2 className="h-3 w-3" />
						Delete Alert
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-2">
			{isAutoFixed(alert) ? (
				// Disabled, with the reason on hover: a disabled button gets no pointer events,
				// so the span carries the tooltip.
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="inline-flex" tabIndex={0}>
							<Button variant="outline" size="sm" className="w-full gap-2" disabled>
								<CheckCircle2 className="h-3 w-3" />
								Resolve
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent>{AUTO_FIX_RESOLVE_REFUSED}</TooltipContent>
				</Tooltip>
			) : (
				<Button variant="outline" size="sm" className="gap-2" onClick={() => onDelete?.(alert.id)}>
					<CheckCircle2 className="h-3 w-3" />
					Resolve
				</Button>
			)}
			{alert.isSilenced ? (
				<Button variant="outline" size="sm" className="gap-2" onClick={() => onUnsilence?.(alert.id)}>
					<RotateCcw className="h-3 w-3" />
					Unsilence
				</Button>
			) : (
				<Button variant="outline" size="sm" className="gap-2" onClick={() => onSilence?.(alert.id)}>
					<BellOff className="h-3 w-3" />
					Silence
				</Button>
			)}
		</div>
	);
};
