import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { formatDate, formatFullTimestamp } from '../../../AlertsTable.utils';
import { CopyCellButton } from '../../CopyCellButton';

export interface AlertUpdatedAtColumnProps {
	alert: Alert;
	className?: string;
	// Inline width from the table\'s shared column-width map; wins over any width class.
	style?: React.CSSProperties;
}

export const AlertUpdatedAtColumn = ({ alert, className, style }: AlertUpdatedAtColumnProps) => {
	const fullTimestamp = formatFullTimestamp(alert.updatedAt);
	return (
		<TableCell style={style} className={cn('relative group/cell py-1 px-2 overflow-hidden', className)}>
			<span className="text-xs text-foreground truncate block" title={fullTimestamp}>
				{formatDate(alert.updatedAt)}
			</span>
			<CopyCellButton value={fullTimestamp ?? String(alert.updatedAt)} />
		</TableCell>
	);
};
