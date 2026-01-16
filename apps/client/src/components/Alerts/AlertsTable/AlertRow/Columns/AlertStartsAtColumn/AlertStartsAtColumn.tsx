import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { formatDate } from '../../../AlertsTable.utils';

export interface AlertStartsAtColumnProps {
	alert: Alert;
	className?: string;
}

export const AlertStartsAtColumn = ({ alert, className }: AlertStartsAtColumnProps) => {
	return (
		<TableCell className={cn('py-1 px-2', className)}>
			<span className="text-xs text-foreground truncate block">{formatDate(alert.startsAt)}</span>
		</TableCell>
	);
};
