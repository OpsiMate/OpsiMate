import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { formatDate, formatFullTimestamp } from '../../../AlertsTable.utils';
import { CopyCellButton } from '../../CopyCellButton';

export interface AlertUpdatedAtColumnProps {
	alert: Alert;
	className?: string;
}

export const AlertUpdatedAtColumn = ({ alert, className }: AlertUpdatedAtColumnProps) => {
	const fullTimestamp = formatFullTimestamp(alert.updatedAt);
	return (
		<TableCell className={cn('relative group/cell py-1 px-2 overflow-hidden', className)}>
			<span className="text-xs text-foreground truncate block" title={fullTimestamp}>
				{formatDate(alert.updatedAt)}
			</span>
			<CopyCellButton value={fullTimestamp ?? String(alert.updatedAt)} />
		</TableCell>
	);
};
