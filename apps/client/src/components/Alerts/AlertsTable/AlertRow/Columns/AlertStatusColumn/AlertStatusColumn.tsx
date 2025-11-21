import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { Alert, AlertStatus } from '@OpsiMate/shared';

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

	// Use AlertStatus enum to determine badge variant
	const status = alert.status;
	
	// Determine badge variant based on status
	let variant: 'default' | 'destructive' | 'outline' | 'secondary' = 'default';
	if (status === AlertStatus.FIRING || status === AlertStatus.ALERTING) {
		variant = 'destructive';
	} else if (status === AlertStatus.RESOLVED || status === AlertStatus.OK) {
		variant = 'secondary';
	} else if (status === AlertStatus.PENDING) {
		variant = 'outline';
	}

	return (
		<Badge variant={variant} className="text-xs px-1.5 py-0.5">
			{alert.status}
		</Badge>
	);
};

export const AlertStatusColumn = ({ alert }: AlertStatusColumnProps) => {
	return <TableCell className="py-1 px-2">{getStatusBadge(alert)}</TableCell>;
};
