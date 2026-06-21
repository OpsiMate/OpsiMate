import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertNameColumnProps {
	alert: Alert;
	className?: string;
}

export const AlertNameColumn = ({ alert, className }: AlertNameColumnProps) => {
	return (
		<TableCell className={cn('py-1 px-2 overflow-hidden', className)}>
			<span
				className={cn(
					'text-sm truncate block text-foreground',
					// Unread alerts: bold the name (the row's own font-medium would otherwise win).
					alert.isRead === false ? 'font-bold' : 'font-medium'
				)}
				title={alert.alertName}
			>
				{alert.alertName}
			</span>
		</TableCell>
	);
};
