import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';
import { AlertsEmptyState } from './AlertsEmptyState';
import {
	ACTIONS_COLUMN,
	COLUMN_LABELS,
	COLUMN_WIDTHS,
	DEFAULT_COLUMN_ORDER,
	DEFAULT_VISIBLE_COLUMNS,
} from './AlertsTable.constants';
import { AlertSortField, AlertsTableProps } from './AlertsTable.types';
import { filterAlerts } from './AlertsTable.utils';
import { ColumnSettingsDropdown } from './ColumnSettingsDropdown';
import { GroupByControls } from './GroupByControls';
import { useAlertGrouping, useAlertSelection, useAlertSorting, useStickyHeaders } from './hooks';
import { SearchBar } from './SearchBar';
import { SortableHeader } from './SortableHeader';
import { StickyGroupHeader } from './StickyGroupHeader';
import { VirtualizedAlertList } from './VirtualizedAlertList';

export const AlertsTable = ({
	alerts,
	onDismissAlert,
	onUndismissAlert,
	onDeleteAlert,
	onSelectAlerts,
	selectedAlerts = [],
	isLoading = false,
	className,
	visibleColumns = DEFAULT_VISIBLE_COLUMNS,
	columnOrder = DEFAULT_COLUMN_ORDER,
	onAlertClick,
	tagKeyColumnLabels = {},
	groupByColumns: controlledGroupBy,
	onGroupByChange,
	onColumnToggle,
	tagKeys = [],
}: AlertsTableProps) => {
	const [searchTerm, setSearchTerm] = useState('');
	const parentRef = useRef<HTMLDivElement>(null);

	const filteredAlerts = useMemo(() => filterAlerts(alerts, searchTerm), [alerts, searchTerm]);

	const allColumnLabels = useMemo(() => ({ ...COLUMN_LABELS, ...tagKeyColumnLabels }), [tagKeyColumnLabels]);

	const { sortField, sortDirection, sortedAlerts, handleSort } = useAlertSorting(filteredAlerts);
	const { groupByColumns, setGroupByColumns, flatRows, toggleGroup } = useAlertGrouping(
		sortedAlerts,
		allColumnLabels,
		controlledGroupBy,
		onGroupByChange
	);
	const { handleSelectAll, handleSelectAlert } = useAlertSelection({ sortedAlerts, selectedAlerts, onSelectAlerts });

	const virtualizer = useVirtualizer({
		count: flatRows.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 32,
		overscan: 5,
		measureElement:
			typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
				? (element) => element?.getBoundingClientRect().height
				: undefined,
	});

	const virtualItems = virtualizer.getVirtualItems();
	const activeStickyHeaders = useStickyHeaders({ flatRows, groupByColumns, virtualItems, virtualizer });

	const orderedColumns = useMemo(() => {
		const filtered = columnOrder.filter((col) => col !== ACTIONS_COLUMN && visibleColumns.includes(col));
		return [...filtered, ACTIONS_COLUMN];
	}, [columnOrder, visibleColumns]);

	// Show empty state if no alerts at all (not just filtered out)
	if (!isLoading && alerts.length === 0) {
		return (
			<div className={cn('flex flex-col gap-2', className)}>
				<AlertsEmptyState />
			</div>
		);
	}

	return (
		<div className={cn('flex flex-col h-full', className)}>
			<div className="mb-2 flex gap-2">
				<div className="flex-1">
					<SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
				</div>
				<GroupByControls
					groupByColumns={groupByColumns}
					onGroupByChange={setGroupByColumns}
					availableColumns={visibleColumns}
					columnLabels={allColumnLabels}
				/>
			</div>

			<div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
				<div className="border-b flex-shrink-0">
					<Table className="table-fixed w-full">
						<TableHeader>
							<TableRow className="h-8">
								{onSelectAlerts && (
									<TableHead
										className="h-8 py-1 px-2"
										style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}
									>
										<div className="flex items-center justify-center">
											<Checkbox
												checked={
													sortedAlerts.length > 0 &&
													selectedAlerts.length === sortedAlerts.length
												}
												onCheckedChange={handleSelectAll}
												className="h-3 w-3 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
											/>
										</div>
									</TableHead>
								)}
								{orderedColumns.map((column) => {
									if (column === ACTIONS_COLUMN) {
										return (
											<TableHead
												key={column}
												className="h-8 py-1 px-2 text-xs"
												style={{ width: '56px', minWidth: '56px', maxWidth: '56px' }}
											>
												<div className="flex items-center justify-end">
													{onColumnToggle && (
														<ColumnSettingsDropdown
															visibleColumns={visibleColumns}
															onColumnToggle={onColumnToggle}
															columnLabels={COLUMN_LABELS}
															excludeColumns={[ACTIONS_COLUMN]}
															tagKeys={tagKeys}
														/>
													)}
												</div>
											</TableHead>
										);
									}
									if (isTagKeyColumn(column)) {
										const tagKey = extractTagKeyFromColumnId(column);
										const label = allColumnLabels[column] || tagKey || column;
										return (
											<SortableHeader
												key={column}
												column={column as AlertSortField}
												label={label}
												sortField={sortField}
												sortDirection={sortDirection}
												onSort={handleSort}
												className={COLUMN_WIDTHS.default}
											/>
										);
									}
									if (
										['alertName', 'status', 'startsAt', 'summary', 'type', 'owner'].includes(column)
									) {
										return (
											<SortableHeader
												key={column}
												column={column as AlertSortField}
												label={allColumnLabels[column]}
												sortField={sortField}
												sortDirection={sortDirection}
												onSort={handleSort}
												className={COLUMN_WIDTHS[column]}
											/>
										);
									}
									return null;
								})}
							</TableRow>
						</TableHeader>
					</Table>
				</div>

				<div className="flex-1 min-h-0 relative">
					<div className="absolute top-0 left-0 right-0 z-20">
						{activeStickyHeaders.map((item) => (
							<StickyGroupHeader
								key={`sticky-${item.type === 'group' ? item.key : ''}`}
								item={item}
								onToggle={toggleGroup}
								columnLabels={allColumnLabels}
							/>
						))}
					</div>

					<div ref={parentRef} className="overflow-auto h-full w-full relative">
						{isLoading ? (
							<div className="flex items-center justify-center py-8 text-sm text-foreground">
								Loading alerts...
							</div>
						) : flatRows.length === 0 ? (
							<div className="flex items-center justify-center py-8 text-sm text-foreground">
								{searchTerm ? 'No alerts found matching your search.' : 'No alerts found.'}
							</div>
						) : (
							<VirtualizedAlertList
								virtualizer={virtualizer}
								flatRows={flatRows}
								selectedAlerts={selectedAlerts}
								orderedColumns={orderedColumns}
								onToggleGroup={toggleGroup}
								onSelectAlert={handleSelectAlert}
								onAlertClick={onAlertClick}
								onDismissAlert={onDismissAlert}
								onUndismissAlert={onUndismissAlert}
								onDeleteAlert={onDeleteAlert}
								onSelectAlerts={onSelectAlerts}
								columnLabels={allColumnLabels}
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
