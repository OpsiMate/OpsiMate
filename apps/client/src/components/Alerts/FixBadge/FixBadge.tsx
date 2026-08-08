import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertFix } from '@OpsiMate/shared';
import { Wand2, Wrench } from 'lucide-react';
import { FIX_LABELS } from '../utils/fix.utils';

// Manual = a hand tool (lucide has no screwdriver; the wrench is its tool-icon stand-in),
// auto = a magic wand.
const FIX_ICONS: Record<AlertFix, typeof Wrench> = {
	[AlertFix.MANUAL]: Wrench,
	[AlertFix.AUTO]: Wand2,
};

const FIX_TEXT_CLASSES: Record<AlertFix, string> = {
	[AlertFix.MANUAL]: 'text-orange-500',
	[AlertFix.AUTO]: 'text-emerald-500',
};

interface FixBadgeProps {
	fix: AlertFix;
	className?: string;
}

// Icon-only fix-type indicator, mirroring SeverityBadge: the label lives in a styled
// tooltip and in an aria-label for assistive tech.
export const FixBadge = ({ fix, className }: FixBadgeProps) => {
	const Icon = FIX_ICONS[fix];
	const label = `Fix: ${FIX_LABELS[fix]}`;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					className={cn('inline-flex items-center shrink-0', FIX_TEXT_CLASSES[fix], className)}
					aria-label={label}
				>
					<Icon className="h-3.5 w-3.5" aria-hidden />
				</span>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
};
