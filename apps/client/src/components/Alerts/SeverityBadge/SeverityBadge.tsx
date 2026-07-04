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
	// Icon-only (table cells) vs icon + label (details panel).
	showLabel?: boolean;
	className?: string;
}

// Colored severity indicator: an icon per level, with an optional text label. The icon
// always carries a tooltip so the icon-only variant stays self-explanatory.
export const SeverityBadge = ({ severity, showLabel = false, className }: SeverityBadgeProps) => {
	const Icon = SEVERITY_ICONS[severity];
	const label = SEVERITY_LABELS[severity];

	return (
		<span
			className={cn('inline-flex items-center gap-1 min-w-0', SEVERITY_TEXT_CLASSES[severity], className)}
			title={`Severity: ${label}`}
		>
			<Icon className="h-3.5 w-3.5 flex-shrink-0" aria-label={label} />
			{showLabel && <span className="text-xs font-medium truncate">{label}</span>}
		</span>
	);
};
