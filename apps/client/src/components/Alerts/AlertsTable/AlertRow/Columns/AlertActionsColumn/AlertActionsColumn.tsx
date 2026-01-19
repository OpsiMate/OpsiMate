import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';
import { ACTIONS_COLUMN_WIDTH } from '../../../AlertsTable.constants';
import { ACTIONS_COLUMN_PADDING } from './AlertActionsColumn.constants';
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
		<TableCell
			className={ACTIONS_COLUMN_PADDING}
			style={{ width: ACTIONS_COLUMN_WIDTH, minWidth: ACTIONS_COLUMN_WIDTH, maxWidth: ACTIONS_COLUMN_WIDTH }}
		>
			<RowActions
				alert={alert}
				onDismissAlert={onDismissAlert}
				onUndismissAlert={onUndismissAlert}
				onDeleteAlert={onDeleteAlert}
			/>
		</TableCell>
	);
};
