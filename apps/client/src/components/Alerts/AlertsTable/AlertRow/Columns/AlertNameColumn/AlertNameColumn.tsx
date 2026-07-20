import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertNameColumnProps {
	alert: Alert;
	// Wrap the full name onto new lines instead of truncating (the "expand rows" toggle).
	expanded?: boolean;
	className?: string;
}

export const AlertNameColumn = ({ alert, expanded = false, className }: AlertNameColumnProps) => {
	return (
		<TableCell className={cn('py-1 px-2 overflow-hidden', className)}>
			<span
				className={cn(
					'text-sm block text-foreground',
					expanded ? 'whitespace-normal break-words line-clamp-6' : 'truncate',
					// Unread alerts: bold the name (the row's own font-medium would otherwise win).
					alert.isRead === false ? 'font-bold' : 'font-medium'
				)}
				title={expanded ? undefined : alert.alertName}
			>
				{alert.alertName}
			</span>
		</TableCell>
	);
};
