import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert, AlertStatus } from '@OpsiMate/shared';

export interface AlertStatusColumnProps {
	alert: Alert;
	className?: string;
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
	const variant = alert.status === AlertStatus.FIRING ? 'destructive' : 'secondary';

	return (
		<Badge variant={variant} className="text-xs px-1.5 py-0.5">
			{alert.status}
		</Badge>
	);
};

export const AlertStatusColumn = ({ alert, className }: AlertStatusColumnProps) => {
	return <TableCell className={cn('py-1 px-2', className)}>{getStatusBadge(alert)}</TableCell>;
};
