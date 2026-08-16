import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { formatDate, formatFullTimestamp } from '../../../AlertsTable.utils';
import { CopyCellButton } from '../../CopyCellButton';

export interface AlertStartsAtColumnProps {
	alert: Alert;
	className?: string;
	// Inline width from the table\'s shared column-width map; wins over any width class.
	style?: React.CSSProperties;
}

export const AlertStartsAtColumn = ({ alert, className, style }: AlertStartsAtColumnProps) => {
	// Today's alerts render time-only (formatDate); the tooltip always carries the full
	// timestamp so the date is one hover away.
	const fullTimestamp = formatFullTimestamp(alert.startsAt);
	return (
		<TableCell style={style} className={cn('relative group/cell py-1 px-2 overflow-hidden', className)}>
			<span className="text-xs text-foreground truncate block" title={fullTimestamp}>
				{formatDate(alert.startsAt)}
			</span>
			<CopyCellButton value={fullTimestamp ?? String(alert.startsAt)} />
		</TableCell>
	);
};
