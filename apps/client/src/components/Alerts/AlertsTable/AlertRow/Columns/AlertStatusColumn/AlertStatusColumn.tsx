import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';

export interface AlertStatusColumnProps {
	alert: Alert;
}

const getStatusBadge = (alert: Alert) => {
	if (alert.isDismissed) {
		return (
			<Badge variant="secondary" className="text-xs px-1.5 py-0.5">
				dismissed
			</Badge>
		);
	}
	return (
		<Badge variant="destructive" className="text-xs px-1.5 py-0.5">
			firing
		</Badge>
	);
};

export const AlertStatusColumn = ({ alert }: AlertStatusColumnProps) => {
	return <TableCell className="py-1 px-2">{getStatusBadge(alert)}</TableCell>;
};
