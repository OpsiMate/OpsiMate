import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { StatusBadge } from '../../../../StatusBadge';

export interface AlertStatusColumnProps {
	alert: Alert;
	className?: string;
}

export const AlertStatusColumn = ({ alert, className }: AlertStatusColumnProps) => {
	return (
		<TableCell className={cn('py-1 px-2 overflow-hidden', className)}>
			<StatusBadge alert={alert} />
		</TableCell>
	);
};
