import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { ACTIONS_COLUMN, COLUMN_WIDTHS, SELECT_COLUMN_WIDTH } from '../AlertsTable.constants';
import { CELL_PADDING } from './AlertRow.constants';
import { getAlertSeverity, SEVERITY_ROW_CLASSES } from '../../utils/severity.utils';
import { AlertActionsColumn } from './Columns/AlertActionsColumn';
import { AlertNameColumn } from './Columns/AlertNameColumn';
import { AlertOwnerColumn } from './Columns/AlertOwnerColumn';
import { AlertSeverityColumn } from './Columns/AlertSeverityColumn';
import { AlertStartsAtColumn } from './Columns/AlertStartsAtColumn';
import { AlertStatusColumn } from './Columns/AlertStatusColumn';
import { AlertSummaryColumn } from './Columns/AlertSummaryColumn';
import { AlertTagKeyColumn } from './Columns/AlertTagKeyColumn';
import { AlertTypeColumn } from './Columns/AlertTypeColumn';

export interface AlertRowProps {
	alert: Alert;
	isSelected: boolean;
	orderedColumns: string[];
	onSelectAlert: (alert: Alert) => void;
	onAlertClick?: (alert: Alert) => void;
	// True when this alert is the one open in the details panel.
	isActiveRow?: boolean;
	onSilenceAlert?: (alertId: string) => void;
	onUnsilenceAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
	onUnresolveAlert?: (alertId: string) => void;
	onSelectAlerts?: (alerts: Alert[]) => void;
	isResolved?: boolean;
	isDragging?: boolean;
	// Tint the whole row by alert severity (the table's "severity colors" toggle).
	severityColors?: boolean;
	onDragStart?: (alert: Alert, e: React.MouseEvent) => void;
	onDragEnter?: (alert: Alert) => void;
	onDragEnd?: () => void;
}

export const AlertRow = ({
	alert,
	isSelected,
	orderedColumns,
	onSelectAlert,
	onAlertClick,
	isActiveRow = false,
	onSilenceAlert,
	onUnsilenceAlert,
	onDeleteAlert,
	onUnresolveAlert,
	onSelectAlerts,
	isResolved = false,
	isDragging = false,
	severityColors = false,
	onDragStart,
	onDragEnter,
	onDragEnd,
}: AlertRowProps) => {
	const handleRowClick = () => {
		onAlertClick?.(alert);
	};

	const handleCheckboxMouseDown = (e: React.MouseEvent) => {
		if (onDragStart) {
			onDragStart(alert, e);
		}
	};

	const handleCheckboxMouseEnter = () => {
		if (onDragEnter) {
			onDragEnter(alert);
		}
	};

	return (
		<TableRow
			className={cn(
				'h-8 cursor-pointer hover:bg-muted/50',
				// Severity tint sits under selection/active highlights so those still win.
				severityColors && SEVERITY_ROW_CLASSES[getAlertSeverity(alert)],
				// Selection carries its own hover class so the severity hover tint can't
				// override the selection cue while the pointer is over the row.
				isSelected && 'bg-muted/50 hover:bg-muted/50',
				// Unread alerts render bold until someone opens them.
				alert.isRead === false && 'font-bold',
				// The alert currently open in the details panel: tinted row + accent edge,
				// inset shadow instead of a border so the columns don't shift.
				isActiveRow && 'bg-primary/10 hover:bg-primary/15 shadow-[inset_3px_0_0_0] shadow-primary'
			)}
			onClick={handleRowClick}
		>
			{onSelectAlerts && (
				<TableCell
					className={cn(CELL_PADDING, 'cursor-pointer select-none')}
					style={{ width: SELECT_COLUMN_WIDTH, minWidth: SELECT_COLUMN_WIDTH, maxWidth: SELECT_COLUMN_WIDTH }}
					onClick={(e) => e.stopPropagation()}
					onMouseDown={handleCheckboxMouseDown}
					onMouseEnter={handleCheckboxMouseEnter}
				>
					<div className="flex items-center justify-center">
						<Checkbox
							checked={isSelected}
							className="h-3 w-3 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary pointer-events-none"
						/>
					</div>
				</TableCell>
			)}
			{orderedColumns.map((column) => {
				if (isTagKeyColumn(column)) {
					const tagKey = extractTagKeyFromColumnId(column);
					if (tagKey) {
						return (
							<AlertTagKeyColumn
								key={column}
								alert={alert}
								tagKey={tagKey}
								className={COLUMN_WIDTHS.default}
							/>
						);
					}
					return null;
				}

				switch (column) {
					case 'type':
						return <AlertTypeColumn key={column} alert={alert} className={COLUMN_WIDTHS.type} />;
					case 'alertName':
						return <AlertNameColumn key={column} alert={alert} className={COLUMN_WIDTHS.alertName} />;
					case 'severity':
						return <AlertSeverityColumn key={column} alert={alert} className={COLUMN_WIDTHS.severity} />;
					case 'status':
						return <AlertStatusColumn key={column} alert={alert} className={COLUMN_WIDTHS.status} />;
					case 'summary':
						return <AlertSummaryColumn key={column} alert={alert} className={COLUMN_WIDTHS.summary} />;
					case 'owner':
						return (
							<AlertOwnerColumn
								key={column}
								alert={alert}
								className={COLUMN_WIDTHS.owner}
								isResolved={isResolved}
							/>
						);
					case 'startsAt':
						return <AlertStartsAtColumn key={column} alert={alert} className={COLUMN_WIDTHS.startsAt} />;
					case ACTIONS_COLUMN:
						return (
							<AlertActionsColumn
								key={column}
								alert={alert}
								onSilenceAlert={onSilenceAlert}
								onUnsilenceAlert={onUnsilenceAlert}
								onDeleteAlert={onDeleteAlert}
								onUnresolveAlert={onUnresolveAlert}
							/>
						);
					default:
						return null;
				}
			})}
		</TableRow>
	);
};
