import { Alert } from '@OpsiMate/shared';
import { Virtualizer } from '@tanstack/react-virtual';
import { useEffect } from 'react';
import { AlertRow } from '../AlertRow';
import { FlatGroupItem } from '../AlertsTable.types';
import { GroupHeader } from '../GroupHeader';

interface VirtualizedAlertListProps {
	virtualizer: Virtualizer<HTMLDivElement, Element>;
	flatRows: FlatGroupItem[];
	selectedAlerts: Alert[];
	orderedColumns: string[];
	onToggleGroup: (key: string) => void;
	onSelectAlert: (alert: Alert) => void;
	onAlertClick?: (alert: Alert) => void;
	activeAlertId?: string | null;
	onSilenceAlert?: (alertId: string) => void;
	onUnsilenceAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
	onUnresolveAlert?: (alertId: string) => void;
	onSelectAlerts?: (alerts: Alert[]) => void;
	columnLabels?: Record<string, string>;
	isResolved?: boolean;
	// Tint rows by alert severity (the "severity colors" toggle).
	severityColors?: boolean;
	// Wrap cell content onto new lines instead of truncating (the "expand rows" toggle).
	expandRows?: boolean;
	// Width of the trailing actions column; must match the header's or columns drift.
	actionsColumnWidth?: string;
	isDragging?: boolean;
	onDragStart?: (alert: Alert, e: React.MouseEvent) => void;
	onDragEnter?: (alert: Alert) => void;
	onDragEnd?: () => void;
}

export const VirtualizedAlertList = ({
	virtualizer,
	flatRows,
	selectedAlerts,
	orderedColumns,
	onToggleGroup,
	onSelectAlert,
	onAlertClick,
	activeAlertId = null,
	onSilenceAlert,
	onUnsilenceAlert,
	onDeleteAlert,
	onUnresolveAlert,
	onSelectAlerts,
	columnLabels,
	isResolved = false,
	severityColors = false,
	expandRows = false,
	actionsColumnWidth,
	isDragging = false,
	onDragStart,
	onDragEnter,
	onDragEnd,
}: VirtualizedAlertListProps) => {
	const virtualItems = virtualizer.getVirtualItems();

	// Global mouseup listener to end drag selection when mouse is released anywhere
	useEffect(() => {
		if (!onDragEnd) return;

		const handleGlobalMouseUp = () => {
			onDragEnd();
		};

		window.addEventListener('mouseup', handleGlobalMouseUp);
		return () => {
			window.removeEventListener('mouseup', handleGlobalMouseUp);
		};
	}, [onDragEnd]);

	// Each virtual row is absolutely positioned, so it never participated in a shared
	// table layout — a row was already its own `display: table` box. Rendering each one
	// as a real single-row <table> keeps that layout identical while producing valid
	// HTML (React 19 logs <div>-in-<tbody> / <tr>-in-<div> nesting as console errors).
	// `text-sm` replaces the removed ui/Table wrapper; the `[&_tr:last-child]:border-0`
	// rule replaces the ui/TableBody one (every row's <tr> is the last child of its own
	// table, which is what kept the rows border-free before, too).
	return (
		<div
			className="text-sm [&_tr:last-child]:border-0"
			style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}
		>
			{virtualItems.map((virtualRow) => {
				const item = flatRows[virtualRow.index];

				if (item.type === 'group') {
					return (
						<div
							key={virtualRow.key}
							data-index={virtualRow.index}
							ref={virtualizer.measureElement}
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								width: '100%',
								transform: `translateY(${virtualRow.start}px)`,
							}}
						>
							<GroupHeader item={item} onToggle={onToggleGroup} columnLabels={columnLabels} />
						</div>
					);
				}

				const alert = item.alert;
				const isSelected = selectedAlerts.some((a) => a.id === alert.id);
				return (
					<table
						key={virtualRow.key}
						data-index={virtualRow.index}
						ref={virtualizer.measureElement}
						className="w-full table-fixed"
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
							width: '100%',
							transform: `translateY(${virtualRow.start}px)`,
						}}
					>
						<tbody>
							<AlertRow
								alert={alert}
								isSelected={isSelected}
								orderedColumns={orderedColumns}
								onSelectAlert={onSelectAlert}
								onAlertClick={onAlertClick}
								isActiveRow={alert.id === activeAlertId}
								onSilenceAlert={onSilenceAlert}
								onUnsilenceAlert={onUnsilenceAlert}
								onDeleteAlert={onDeleteAlert}
								onUnresolveAlert={onUnresolveAlert}
								onSelectAlerts={onSelectAlerts}
								isResolved={isResolved}
								severityColors={severityColors}
								expandRows={expandRows}
								actionsColumnWidth={actionsColumnWidth}
								isDragging={isDragging}
								onDragStart={onDragStart}
								onDragEnter={onDragEnter}
								onDragEnd={onDragEnd}
							/>
						</tbody>
					</table>
				);
			})}
		</div>
	);
};
