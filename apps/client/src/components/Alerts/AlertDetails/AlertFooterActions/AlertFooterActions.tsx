import { Button } from '@/components/ui/button';
import { Alert } from '@OpsiMate/shared';
import { BellOff, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';

interface AlertFooterActionsProps {
	alert: Alert;
	isActive: boolean;
	onSilence?: (alertId: string) => void;
	onUnsilence?: (alertId: string) => void;
	onDelete?: (alertId: string) => void;
}

// The alert's primary actions, pinned as a one-row footer at the bottom of the details
// panel (outside the scroll area) so they're always reachable.
export const AlertFooterActions = ({ alert, isActive, onSilence, onUnsilence, onDelete }: AlertFooterActionsProps) => {
	if (!isActive) {
		return (
			<Button variant="destructive" size="sm" className="w-full gap-2" onClick={() => onDelete?.(alert.id)}>
				<Trash2 className="h-3 w-3" />
				Delete Alert
			</Button>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-2">
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
			<Button variant="outline" size="sm" className="gap-2" onClick={() => onDelete?.(alert.id)}>
				<CheckCircle2 className="h-3 w-3" />
				Resolve
			</Button>
		</div>
	);
};
