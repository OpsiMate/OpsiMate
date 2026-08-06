import { Fragment } from 'react';
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
import { AlertLastCommentColumn } from './Columns/AlertLastCommentColumn';
import { AlertSummaryColumn } from './Columns/AlertSummaryColumn';
import { AlertTagKeyColumn } from './Columns/AlertTagKeyColumn';
import { AlertTypeColumn } from './Columns/AlertTypeColumn';
import { AlertUpdatedAtColumn } from './Columns/AlertUpdatedAtColumn';

export interface AlertRowProps {
	alert: Alert;
	isSelected: boolean;
	orderedColumns: string[];
	// Content-aware pixel widths for alertName/tag columns; must match the header's.
	contentColumnWidths?: Record<string, number>;
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
	// Wrap cell content onto new lines instead of truncating (the "expand rows" toggle).
	expandRows?: boolean;
	// Width of the trailing actions column; must match the header's or columns drift.
	actionsColumnWidth?: string;
	onDragStart?: (alert: Alert, e: React.MouseEvent) => void;
	onDragEnter?: (alert: Alert) => void;
	onDragEnd?: () => void;
}

export const AlertRow = ({
	alert,
	isSelected,
	orderedColumns,
	contentColumnWidths = {},
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
	expandRows = false,
	actionsColumnWidth,
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

	const handleRowMouseEnter = () => {
		// During drag selection, entering any part of the row should trigger the drag
		// selection handler, not just the checkbox column (#712). No isDragging guard:
		// isDragging only turns true after the first drag-enter, so gating on it would
		// ignore the first row the cursor reaches after leaving the checkbox column.
		// The hook itself no-ops unless the mouse went down on a checkbox.
		if (onDragEnter) {
			onDragEnter(alert);
		}
	};

	return (
		<TableRow
			data-alert-id={alert.id}
			className={cn(
				'h-8 cursor-pointer hover:bg-muted/50',
				// Severity tint sits under selection/active highlights so those still win.
				severityColors && SEVERITY_ROW_CLASSES[getAlertSeverity(alert)],
				// Selection carries its own hover class so the severity hover tint can't
				// override the selection cue while the pointer is over the row.
				isSelected && 'bg-muted/50 hover:bg-muted/50',
				// Unread alerts render at the heaviest weight until someone opens them, so an
				// updated or freshly firing row stands out clearly from the regular-weight ones.
				alert.isRead === false && 'font-black',
				// The alert currently open in the details panel: tinted row + accent edge,
				// inset shadow instead of a border so the columns don't shift.
				isActiveRow && 'bg-primary/10 hover:bg-primary/15 shadow-[inset_3px_0_0_0] shadow-primary'
			)}
			onClick={handleRowClick}
			onMouseEnter={handleRowMouseEnter}
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
								expanded={expandRows}
								className={COLUMN_WIDTHS.default}
								style={contentColumnWidths[column] ? { width: contentColumnWidths[column] } : undefined}
							/>
						);
					}
					return null;
				}

				switch (column) {
					case 'type':
						return <AlertTypeColumn key={column} alert={alert} className={COLUMN_WIDTHS.type} />;
					case 'alertName':
						return (
							<AlertNameColumn
								key={column}
								alert={alert}
								expanded={expandRows}
								className={COLUMN_WIDTHS.alertName}
								style={
									contentColumnWidths['alertName']
										? { width: contentColumnWidths['alertName'] }
										: undefined
								}
							/>
						);
					case 'severity':
						return <AlertSeverityColumn key={column} alert={alert} className={COLUMN_WIDTHS.severity} />;
					case 'status':
						return <AlertStatusColumn key={column} alert={alert} className={COLUMN_WIDTHS.status} />;
					case 'summary':
						return (
							<AlertSummaryColumn
								key={column}
								alert={alert}
								expanded={expandRows}
								className={COLUMN_WIDTHS.summary}
							/>
						);
					case 'lastComment':
						return (
							<AlertLastCommentColumn
								key={column}
								alert={alert}
								expanded={expandRows}
								className={COLUMN_WIDTHS.lastComment}
							/>
						);
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
					case 'updatedAt':
						return <AlertUpdatedAtColumn key={column} alert={alert} className={COLUMN_WIDTHS.updatedAt} />;
					case ACTIONS_COLUMN:
						return (
							<Fragment key={column}>
								{/* Mirrors the header's filler (see AlertsTable): when summary is
								    hidden this empty flexible cell absorbs the leftover width. */}
								{!orderedColumns.includes('summary') && <TableCell aria-hidden className="p-0" />}
								<AlertActionsColumn
									alert={alert}
									width={actionsColumnWidth}
									onSilenceAlert={onSilenceAlert}
									onUnsilenceAlert={onUnsilenceAlert}
									onDeleteAlert={onDeleteAlert}
									onUnresolveAlert={onUnresolveAlert}
								/>
							</Fragment>
						);
					default:
						return null;
				}
			})}
		</TableRow>
	);
};
