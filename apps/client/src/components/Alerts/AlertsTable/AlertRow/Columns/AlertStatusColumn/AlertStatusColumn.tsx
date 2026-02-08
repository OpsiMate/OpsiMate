import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert, AlertStatus } from '@OpsiMate/shared';

export interface AlertStatusColumnProps {
	alert: Alert;
	className?: string;
}

const capitalizeFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

const getStatusBadge = (alert: Alert) => {
	if (alert.isDismissed) {
		return (
			<Badge variant="muted" className="text-xs px-1.5 py-0.5">
				Dismissed
			</Badge>
		);
	}

	// Use AlertStatus enum to determine badge variant
	const variant = alert.status === AlertStatus.FIRING ? 'destructive' : 'success';

	return (
		<Badge variant={variant} className="text-xs px-1.5 py-0.5">
			{capitalizeFirst(alert.status)}
		</Badge>
	);
};

export const AlertStatusColumn = ({ alert, className }: AlertStatusColumnProps) => {
	return <TableCell className={cn('py-1 px-2 overflow-hidden', className)}>{getStatusBadge(alert)}</TableCell>;
};
