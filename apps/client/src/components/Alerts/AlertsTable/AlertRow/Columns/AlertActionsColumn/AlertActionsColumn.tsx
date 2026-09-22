import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';
import { ACTIONS_COLUMN_WIDTH } from '../../../AlertsTable.constants';
import { ACTIONS_COLUMN_PADDING } from './AlertActionsColumn.constants';
import { RowActions } from '../../RowActions';

export interface AlertActionsColumnProps {
	alert: Alert;
	// Must match the header's actions-column width or the fixed-layout columns drift.
	width?: string;
	onSilenceAlert?: (alertId: string) => void;
	onUnsilenceAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
	onUnresolveAlert?: (alertId: string) => void;
	onRemoveFromIncident?: (alertId: string) => void;
}

export const AlertActionsColumn = ({
	alert,
	width = ACTIONS_COLUMN_WIDTH,
	onSilenceAlert,
	onUnsilenceAlert,
	onDeleteAlert,
	onUnresolveAlert,
	onRemoveFromIncident,
}: AlertActionsColumnProps) => {
	return (
		<TableCell className={ACTIONS_COLUMN_PADDING} style={{ width, minWidth: width, maxWidth: width }}>
			<RowActions
				alert={alert}
				onSilenceAlert={onSilenceAlert}
				onUnsilenceAlert={onUnsilenceAlert}
				onDeleteAlert={onDeleteAlert}
				onUnresolveAlert={onUnresolveAlert}
				onRemoveFromIncident={onRemoveFromIncident}
			/>
		</TableCell>
	);
};
