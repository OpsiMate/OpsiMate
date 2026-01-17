import { Table, TableBody } from '@/components/ui/table';
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
	onDismissAlert?: (alertId: string) => void;
	onUndismissAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
	onSelectAlerts?: (alerts: Alert[]) => void;
	columnLabels?: Record<string, string>;
	isArchived?: boolean;
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
	onDismissAlert,
	onUndismissAlert,
	onDeleteAlert,
	onSelectAlerts,
	columnLabels,
	isArchived = false,
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

	return (
		<div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
			<Table className="w-full table-fixed">
				<TableBody>
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
									display: 'table',
									tableLayout: 'fixed',
								}}
							>
								<AlertRow
									alert={alert}
									isSelected={isSelected}
									orderedColumns={orderedColumns}
									onSelectAlert={onSelectAlert}
									onAlertClick={onAlertClick}
									onDismissAlert={onDismissAlert}
									onUndismissAlert={onUndismissAlert}
									onDeleteAlert={onDeleteAlert}
									onSelectAlerts={onSelectAlerts}
									isArchived={isArchived}
									isDragging={isDragging}
									onDragStart={onDragStart}
									onDragEnter={onDragEnter}
									onDragEnd={onDragEnd}
								/>
							</div>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
};
