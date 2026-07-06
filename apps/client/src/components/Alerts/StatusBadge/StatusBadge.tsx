import { cn } from '@/lib/utils';
import { Alert, AlertStatus } from '@OpsiMate/shared';
import { BellOff, CircleCheck, Flame, VolumeX } from 'lucide-react';

interface StatusIndicator {
	Icon: typeof Flame;
	label: string;
	className: string;
	testId?: string;
}

// Precedence mirrors the old status badge: dismissed wins over silenced, which wins over
// the firing/resolved lifecycle state.
const getStatusIndicator = (alert: Alert): StatusIndicator => {
	if (alert.isDismissed) return { Icon: BellOff, label: 'Dismissed', className: 'text-muted-foreground' };
	if (alert.isSilenced)
		return { Icon: VolumeX, label: 'Silenced', className: 'text-amber-500', testId: 'alert-status-silenced' };
	if (alert.status === AlertStatus.FIRING) return { Icon: Flame, label: 'Firing', className: 'text-red-500' };
	return { Icon: CircleCheck, label: 'Resolved', className: 'text-emerald-500' };
};

interface StatusBadgeProps {
	alert: Alert;
	className?: string;
}

// Icon-only alert status (firing / resolved / silenced / dismissed) with the label in a
// tooltip, matching SeverityBadge so the two can sit side by side in narrow columns.
export const StatusBadge = ({ alert, className }: StatusBadgeProps) => {
	const { Icon, label, className: colorClass, testId } = getStatusIndicator(alert);

	return (
		<span
			className={cn('inline-flex items-center flex-shrink-0', colorClass, className)}
			title={`Status: ${label}`}
			data-testid={testId}
		>
			<Icon className="h-3.5 w-3.5" aria-label={label} />
		</span>
	);
};
