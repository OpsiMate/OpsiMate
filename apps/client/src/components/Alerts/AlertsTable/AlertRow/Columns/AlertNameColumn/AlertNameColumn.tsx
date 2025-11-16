import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';

export interface AlertNameColumnProps {
	alert: Alert;
}

export const AlertNameColumn = ({ alert }: AlertNameColumnProps) => {
	return (
		<TableCell className="py-1 px-2">
			<span className="text-sm font-medium truncate block max-w-xs" title={alert.alertName}>
				{alert.alertName}
			</span>
		</TableCell>
	);
};
