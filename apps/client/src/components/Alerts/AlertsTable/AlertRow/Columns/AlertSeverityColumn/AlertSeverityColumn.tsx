import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { SeverityBadge } from '../../../../SeverityBadge';
import { getAlertSeverity } from '../../../../utils/severity.utils';

export interface AlertSeverityColumnProps {
	alert: Alert;
	className?: string;
}

export const AlertSeverityColumn = ({ alert, className }: AlertSeverityColumnProps) => {
	return (
		<TableCell className={cn('py-1 px-2 overflow-hidden', className)}>
			<SeverityBadge severity={getAlertSeverity(alert)} />
		</TableCell>
	);
};
