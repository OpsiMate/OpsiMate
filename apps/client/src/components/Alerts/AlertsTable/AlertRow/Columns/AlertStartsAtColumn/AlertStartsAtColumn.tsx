import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';
import { formatDate } from '../../../AlertsTable.utils';

export interface AlertStartsAtColumnProps {
	alert: Alert;
}

export const AlertStartsAtColumn = ({ alert }: AlertStartsAtColumnProps) => {
	return (
		<TableCell className="py-1 px-2">
			<span className="text-sm text-muted-foreground">{formatDate(alert.startsAt)}</span>
		</TableCell>
	);
};
