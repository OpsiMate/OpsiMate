import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { AlertDragData, dragId, dropId } from '../../AlertDragAndDrop';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { ACTIONS_COLUMN, COLUMN_SEPARATOR_CLASSES, COLUMN_WIDTHS, SELECT_COLUMN_WIDTH } from '../AlertsTable.constants';
import { CELL_PADDING } from './AlertRow.constants';
import { copyValueOf, isForeignTarget, isPrimaryPress, isSelectCellTarget, isToggleModifier } from './AlertRow.utils';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { AlertCellContextMenu } from './AlertCellContextMenu';
import { getAlertSeverity, SEVERITY_ROW_CLASSES } from '../../utils/severity.utils';
import { AlertActionsColumn } from './Columns/AlertActionsColumn';
import { AlertNameColumn } from './Columns/AlertNameColumn';
import { AlertOwnerColumn } from './Columns/AlertOwnerColumn';
import { AlertFixColumn } from './Columns/AlertFixColumn';
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
	// Shift+click: select every row from the last toggled one to this one.
	onSelectRange?: (alert: Alert) => void;
	// Plain click: the selection becomes just this row (alongside opening its details).
	onSelectOnly?: (alert: Alert) => void;
	onAlertClick?: (alert: Alert) => void;
	// True when this alert is the one open in the details panel.
	isActiveRow?: boolean;
	onSilenceAlert?: (alertId: string) => void;
	onUnsilenceAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
	onUnresolveAlert?: (alertId: string) => void;
	// Set on rows rendered under an incident folder; adds "Remove from incident".
	onRemoveFromIncident?: (alertId: string) => void;
	// Drag the row (or the selection it is part of) onto an incident folder, another row,
	// or the drop tray; and accept drops. The page owns the DndContext and the outcome.
	dragAndDrop?: boolean;
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
	onSelectRange,
	onSelectOnly,
	onAlertClick,
	isActiveRow = false,
	onSilenceAlert,
	onUnsilenceAlert,
	onDeleteAlert,
	onUnresolveAlert,
	onRemoveFromIncident,
	dragAndDrop = false,
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
	// Selection from anywhere on the row: Cmd/Ctrl + press starts the same drag selection
	// as the checkbox column — release in place toggles the row, drag selects every row
	// passed over. Shift+click selects a range. None of these open the details panel.
	// Set by a Ctrl+left press on the row itself, so its contextmenu (button 0 or 2) is suppressed.
	const ctrlPrimaryPressRef = useRef(false);

	const dragData: AlertDragData = { alert };
	const {
		setNodeRef: setDragRef,
		listeners: dragListeners,
		isDragging: isBeingDragged,
	} = useDraggable({ id: dragId(alert.id), data: dragData, disabled: !dragAndDrop });
	const { setNodeRef: setDropRef, isOver: isDropTarget } = useDroppable({
		id: dropId.alert(alert.id),
		data: dragData,
		disabled: !dragAndDrop,
	});
	// One stable ref callback: a new identity each render would make React detach and
	// re-attach the node, and dnd-kit re-observe the row, on every re-render during a drag.
	const setRowRef = useCallback(
		(node: HTMLTableRowElement | null) => {
			setDragRef(node);
			setDropRef(node);
		},
		[setDragRef, setDropRef]
	);
	// The click that ends a drag lands on this row; it must not open or select it. The
	// flag is armed for the drag and disarmed a tick after it ends: the browser fires that
	// click (if the pointer is still over this row) before a zero-delay timer runs, and a
	// drop elsewhere produces no click at all, so the next real click must go through.
	const wasDragging = useRef(false);
	useEffect(() => {
		if (isBeingDragged) {
			wasDragging.current = true;
			return;
		}
		const disarm = setTimeout(() => {
			wasDragging.current = false;
		}, 0);
		return () => clearTimeout(disarm);
	}, [isBeingDragged]);

	const handleRowClick = (e: React.MouseEvent) => {
		if (wasDragging.current) {
			wasDragging.current = false;
			return;
		}
		if (onSelectAlerts && isToggleModifier(e)) {
			// The toggle already happened on mouseup via the drag hook; without one, toggle here.
			if (!onDragStart && !isForeignTarget(e)) onSelectAlert(alert);
			return;
		}
		if (onSelectAlerts && e.shiftKey) {
			if (!isForeignTarget(e)) (onSelectRange ?? onSelectAlert)(alert);
			return;
		}
		// A plain click both opens the row and makes it THE selection, so the bulk
		// actions always apply to what the user is looking at. Controls inside the row
		// (owner picker, actions menu) keep their own click.
		if (onSelectAlerts && !isForeignTarget(e)) onSelectOnly?.(alert);
		onAlertClick?.(alert);
	};

	const handleRowMouseDown = (e: React.MouseEvent) => {
		// The checkbox cell's own handler already took this press (and set the Ctrl flag).
		if (isSelectCellTarget(e)) return;
		const isOwnPrimaryPress = !!onSelectAlerts && isPrimaryPress(e) && !isForeignTarget(e);
		ctrlPrimaryPressRef.current = isOwnPrimaryPress && e.ctrlKey;
		if (!isOwnPrimaryPress) return;
		// Shift+mousedown would otherwise highlight the text between the two clicked rows.
		// Cmd/Ctrl wins over Shift, as in handleRowClick: Cmd+Shift+click is a toggle.
		if (e.shiftKey && !isToggleModifier(e)) {
			e.preventDefault();
			return;
		}
		if (isToggleModifier(e) && onDragStart) onDragStart(alert, e);
	};

	// macOS turns Ctrl+click into a right-click: contextmenu fires instead of click. The
	// mousedown/mouseup pair still fires, so the drag hook does the toggle; only the menu
	// needs suppressing. A real right-click (button 2, no Ctrl+left press) keeps its menu.
	const handleRowContextMenu = (e: React.MouseEvent) => {
		const fromCtrlPrimaryPress = ctrlPrimaryPressRef.current;
		ctrlPrimaryPressRef.current = false;
		if (!onSelectAlerts || !e.ctrlKey || isForeignTarget(e)) return;
		if (e.button !== 2 || fromCtrlPrimaryPress) {
			e.preventDefault();
			if (!onDragStart) onSelectAlert(alert);
		}
	};

	const handleCheckboxMouseDown = (e: React.MouseEvent) => {
		// No stopPropagation: it would also stop the native event, hiding the press from
		// document/window mousedown listeners (click-away closers). The row skips this cell.
		const isOwnPrimaryPress = isPrimaryPress(e);
		ctrlPrimaryPressRef.current = isOwnPrimaryPress && e.ctrlKey;
		// A right or middle press opens a menu or autoscrolls; it is not a selection gesture.
		if (!isOwnPrimaryPress) return;
		// Shift+click on a checkbox is a range too; skip the drag so mouseup doesn't toggle it back.
		// Cmd/Ctrl wins over Shift, as on the row.
		if (e.shiftKey && !isToggleModifier(e) && onSelectRange) {
			e.preventDefault();
			onSelectRange(alert);
			return;
		}
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
		// The hook itself no-ops unless the mouse went down on a checkbox or Cmd/Ctrl+row.
		if (onDragEnter) {
			onDragEnter(alert);
		}
	};

	// The cell under a right-click, captured as the menu opens so its items know what to
	// copy. A right-click from a portaled child (the owner picker, the actions menu) is
	// theirs: no row menu, and no browser menu either.
	const [copyValue, setCopyValue] = useState<string | null>(null);
	const handleMenuContextMenu = (e: React.MouseEvent) => {
		if (isForeignTarget(e)) {
			e.preventDefault();
			return;
		}
		setCopyValue(copyValueOf(e.target));
	};

	return (
		<ContextMenu modal={false}>
			<ContextMenuTrigger asChild onContextMenu={handleMenuContextMenu}>
				<TableRow
					ref={setRowRef}
					data-alert-id={alert.id}
					{...(dragAndDrop ? dragListeners : {})}
					className={cn(
						'h-8 cursor-pointer hover:bg-muted/50',
						COLUMN_SEPARATOR_CLASSES,
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
						isActiveRow && 'bg-primary/10 hover:bg-primary/15 shadow-[inset_3px_0_0_0] shadow-primary',
						// Drag and drop: the dragged row dims (the overlay follows the pointer); a row
						// under a drag shows it will take the drop.
						dragAndDrop && 'select-none',
						isBeingDragged && 'opacity-40',
						isDropTarget && 'ring-2 ring-inset ring-primary bg-primary/10'
					)}
					onClick={handleRowClick}
					onMouseDown={handleRowMouseDown}
					onContextMenu={handleRowContextMenu}
					onMouseEnter={handleRowMouseEnter}
				>
					{onSelectAlerts && (
						<TableCell
							className={cn(CELL_PADDING, 'cursor-pointer select-none')}
							style={{
								width: SELECT_COLUMN_WIDTH,
								minWidth: SELECT_COLUMN_WIDTH,
								maxWidth: SELECT_COLUMN_WIDTH,
							}}
							onClick={(e) => e.stopPropagation()}
							data-select-cell
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
										style={
											contentColumnWidths[column]
												? { width: contentColumnWidths[column] }
												: undefined
										}
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
								return (
									<AlertSeverityColumn
										key={column}
										alert={alert}
										className={COLUMN_WIDTHS.severity}
									/>
								);
							case 'fix':
								return <AlertFixColumn key={column} alert={alert} className={COLUMN_WIDTHS.fix} />;
							case 'status':
								return (
									<AlertStatusColumn key={column} alert={alert} className={COLUMN_WIDTHS.status} />
								);
							case 'summary':
								return (
									<AlertSummaryColumn
										key={column}
										alert={alert}
										expanded={expandRows}
										className={COLUMN_WIDTHS.summary}
										style={
											contentColumnWidths['summary']
												? { width: contentColumnWidths['summary'] }
												: undefined
										}
									/>
								);
							case 'lastComment':
								return (
									<AlertLastCommentColumn
										key={column}
										alert={alert}
										expanded={expandRows}
										className={COLUMN_WIDTHS.lastComment}
										style={
											contentColumnWidths['lastComment']
												? { width: contentColumnWidths['lastComment'] }
												: undefined
										}
									/>
								);
							case 'owner':
								return (
									<AlertOwnerColumn
										key={column}
										alert={alert}
										className={COLUMN_WIDTHS.owner}
										isResolved={isResolved}
										style={
											contentColumnWidths['owner']
												? { width: contentColumnWidths['owner'] }
												: undefined
										}
									/>
								);
							case 'startsAt':
								return (
									<AlertStartsAtColumn
										key={column}
										alert={alert}
										className={COLUMN_WIDTHS.startsAt}
										style={
											contentColumnWidths['startsAt']
												? { width: contentColumnWidths['startsAt'] }
												: undefined
										}
									/>
								);
							case 'updatedAt':
								return (
									<AlertUpdatedAtColumn
										key={column}
										alert={alert}
										className={COLUMN_WIDTHS.updatedAt}
										style={
											contentColumnWidths['updatedAt']
												? { width: contentColumnWidths['updatedAt'] }
												: undefined
										}
									/>
								);
							case ACTIONS_COLUMN:
								return (
									<Fragment key={column}>
										{/* Mirrors the header's filler (see AlertsTable): when summary is
								    hidden — or pinned to a manual width, which appears in the width
								    map — this empty flexible cell absorbs the leftover width. The
								    condition MUST match the header's needsFillerColumn or the two
								    layouts misalign. */}
										{(!orderedColumns.includes('summary') ||
											contentColumnWidths['summary'] !== undefined) && (
											<TableCell aria-hidden className="p-0" />
										)}
										<AlertActionsColumn
											alert={alert}
											width={actionsColumnWidth}
											onSilenceAlert={onSilenceAlert}
											onUnsilenceAlert={onUnsilenceAlert}
											onDeleteAlert={onDeleteAlert}
											onUnresolveAlert={onUnresolveAlert}
											onRemoveFromIncident={onRemoveFromIncident}
										/>
									</Fragment>
								);
							default:
								return null;
						}
					})}
				</TableRow>
			</ContextMenuTrigger>
			<AlertCellContextMenu alert={alert} cellValue={copyValue} />
		</ContextMenu>
	);
};
