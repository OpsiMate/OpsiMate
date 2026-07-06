import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertSeverity } from '@OpsiMate/shared';
import { Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import { SEVERITY_LABELS, SEVERITY_TEXT_CLASSES } from '../utils/severity.utils';

const SEVERITY_ICONS: Record<AlertSeverity, typeof Info> = {
	[AlertSeverity.CRITICAL]: OctagonAlert,
	[AlertSeverity.WARNING]: TriangleAlert,
	[AlertSeverity.INFO]: Info,
};

interface SeverityBadgeProps {
	severity: AlertSeverity;
	className?: string;
}

// Icon-only colored severity indicator; the label lives in a styled tooltip (same Radix
// tooltip the table headers use) and in an aria-label for assistive tech.
export const SeverityBadge = ({ severity, className }: SeverityBadgeProps) => {
	const Icon = SEVERITY_ICONS[severity];
	const label = `Severity: ${SEVERITY_LABELS[severity]}`;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					className={cn('inline-flex items-center flex-shrink-0', SEVERITY_TEXT_CLASSES[severity], className)}
					aria-label={label}
				>
					<Icon className="h-3.5 w-3.5" aria-hidden />
				</span>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
};
