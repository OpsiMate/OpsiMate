import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertSummaryColumnProps {
	alert: Alert;
	className?: string;
}

export const AlertSummaryColumn = ({ alert, className }: AlertSummaryColumnProps) => {
	return (
		<TableCell className={cn('py-1 px-2', className)}>
			<span className="text-sm text-muted-foreground truncate max-w-xs block">{alert.summary || '-'}</span>
		</TableCell>
	);
};
