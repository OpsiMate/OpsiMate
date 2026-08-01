import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { formatDate } from '../../../AlertsTable.utils';

export interface AlertStartsAtColumnProps {
	alert: Alert;
	className?: string;
}

export const AlertStartsAtColumn = ({ alert, className }: AlertStartsAtColumnProps) => {
	// Today's alerts render time-only (formatDate); the tooltip always carries the full
	// timestamp so the date is one hover away.
	const date = new Date(alert.startsAt);
	const fullTimestamp = isNaN(date.getTime()) ? undefined : date.toLocaleString();
	return (
		<TableCell className={cn('py-1 px-2 overflow-hidden', className)}>
			<span className="text-xs text-foreground truncate block" title={fullTimestamp}>
				{formatDate(alert.startsAt)}
			</span>
		</TableCell>
	);
};
