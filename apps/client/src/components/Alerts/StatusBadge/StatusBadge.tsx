import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Alert, AlertStatus } from '@OpsiMate/shared';
import { BellOff, CircleCheck, Flame, VolumeX } from 'lucide-react';

interface StatusIndicator {
	Icon: typeof Flame;
	label: string;
	className: string;
	testId?: string;
}

// Precedence mirrors the old status badge: silenced wins over muted, which wins over
// the firing/resolved lifecycle state.
// "Jul 19, 14:30" in the viewer's locale/timezone — enough to know when the silence lifts.
const formatSilencedUntil = (iso: string): string =>
	new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const getStatusIndicator = (alert: Alert): StatusIndicator => {
	if (alert.isSilenced)
		return {
			Icon: BellOff,
			label: alert.silencedUntil ? `Silenced until ${formatSilencedUntil(alert.silencedUntil)}` : 'Silenced',
			className: 'text-muted-foreground',
		};
	if (alert.isMuted)
		return { Icon: VolumeX, label: 'Muted', className: 'text-amber-500', testId: 'alert-status-muted' };
	if (alert.status === AlertStatus.FIRING) return { Icon: Flame, label: 'Firing', className: 'text-red-500' };
	return { Icon: CircleCheck, label: 'Resolved', className: 'text-emerald-500' };
};

interface StatusBadgeProps {
	alert: Alert;
	className?: string;
}

// Icon-only alert status (firing / resolved / muted / silenced); the label lives in a
// styled tooltip (same Radix tooltip the table headers use) and in an aria-label.
export const StatusBadge = ({ alert, className }: StatusBadgeProps) => {
	const { Icon, label, className: colorClass, testId } = getStatusIndicator(alert);
	const fullLabel = `Status: ${label}`;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					className={cn('inline-flex items-center flex-shrink-0', colorClass, className)}
					aria-label={fullLabel}
					data-testid={testId}
				>
					<Icon className="h-3.5 w-3.5" aria-hidden />
				</span>
			</TooltipTrigger>
			<TooltipContent>{fullLabel}</TooltipContent>
		</Tooltip>
	);
};
