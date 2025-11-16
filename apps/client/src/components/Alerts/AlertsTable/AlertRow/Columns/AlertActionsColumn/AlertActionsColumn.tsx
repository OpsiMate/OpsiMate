import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';
import { RowActions } from '../../RowActions';

export interface AlertActionsColumnProps {
	alert: Alert;
	onDismissAlert?: (alertId: string) => void;
	onUndismissAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
}

export const AlertActionsColumn = ({
	alert,
	onDismissAlert,
	onUndismissAlert,
	onDeleteAlert,
}: AlertActionsColumnProps) => {
	return (
		<TableCell className="py-1 px-2" onClick={(e) => e.stopPropagation()}>
			<RowActions
				alert={alert}
				onDismissAlert={onDismissAlert}
				onUndismissAlert={onUndismissAlert}
				onDeleteAlert={onDeleteAlert}
			/>
		</TableCell>
	);
};
