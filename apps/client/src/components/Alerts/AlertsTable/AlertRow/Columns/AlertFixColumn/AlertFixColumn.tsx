import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { FixBadge } from '../../../../FixBadge';
import { getAlertFix } from '../../../../utils/fix.utils';

export interface AlertFixColumnProps {
	alert: Alert;
	className?: string;
}

// Icon-only fix-type cell (wrench = manual, wand = auto); most alerts carry no fix
// classification and render the empty dash.
export const AlertFixColumn = ({ alert, className }: AlertFixColumnProps) => {
	const fix = getAlertFix(alert);
	return (
		<TableCell className={cn('py-1 px-2 overflow-hidden', className)}>
			{fix ? <FixBadge fix={fix} /> : <span className="text-foreground text-xs">-</span>}
		</TableCell>
	);
};
