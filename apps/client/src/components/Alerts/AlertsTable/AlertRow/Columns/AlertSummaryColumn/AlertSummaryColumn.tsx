import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';

export interface AlertSummaryColumnProps {
	alert: Alert;
}

export const AlertSummaryColumn = ({ alert }: AlertSummaryColumnProps) => {
	return (
		<TableCell className="py-1 px-2">
			<span className="text-sm text-muted-foreground truncate max-w-xs block">{alert.summary || '-'}</span>
		</TableCell>
	);
};
