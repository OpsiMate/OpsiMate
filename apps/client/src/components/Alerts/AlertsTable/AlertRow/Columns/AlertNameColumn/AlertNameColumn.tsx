import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertNameColumnProps {
	alert: Alert;
	className?: string;
}

export const AlertNameColumn = ({ alert, className }: AlertNameColumnProps) => {
	return (
		<TableCell className={cn('py-1 px-2', className)}>
			<span className="text-sm font-medium truncate block text-foreground" title={alert.alertName}>
				{alert.alertName}
			</span>
		</TableCell>
	);
};
