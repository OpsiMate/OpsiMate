import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { RowActions } from '../../RowActions';

export interface AlertActionsColumnProps {
	alert: Alert;
	onDismissAlert?: (alertId: string) => void;
	onUndismissAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
	className?: string;
}

export const AlertActionsColumn = ({
	alert,
	onDismissAlert,
	onUndismissAlert,
	onDeleteAlert,
	className,
}: AlertActionsColumnProps) => {
	return (
		<TableCell className={cn('py-1 px-2', className)} onClick={(e) => e.stopPropagation()}>
			<RowActions
				alert={alert}
				onDismissAlert={onDismissAlert}
				onUndismissAlert={onUndismissAlert}
				onDeleteAlert={onDeleteAlert}
			/>
		</TableCell>
	);
};
