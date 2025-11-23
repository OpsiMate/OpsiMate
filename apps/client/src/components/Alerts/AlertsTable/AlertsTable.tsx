import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Settings } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { AlertsEmptyState } from './AlertsEmptyState';
import { COLUMN_LABELS, DEFAULT_COLUMN_ORDER, DEFAULT_VISIBLE_COLUMNS } from './AlertsTable.constants';
import { AlertSortField, AlertsTableProps } from './AlertsTable.types';
import { createServiceNameLookup, filterAlerts } from './AlertsTable.utils';
import { GroupByControls } from './GroupByControls';
import { useAlertGrouping, useAlertSelection, useAlertSorting, useStickyHeaders } from './hooks';
import { SearchBar } from './SearchBar';
import { SortableHeader } from './SortableHeader';
import { StickyGroupHeader } from './StickyGroupHeader';
import { VirtualizedAlertList } from './VirtualizedAlertList';

export const AlertsTable = ({
	alerts,
	services,
	onDismissAlert,
	onUndismissAlert,
	onDeleteAlert,
	onSelectAlerts,
	selectedAlerts = [],
	isLoading = false,
	className,
	onTableSettingsClick,
	visibleColumns = DEFAULT_VISIBLE_COLUMNS,
	columnOrder = DEFAULT_COLUMN_ORDER,
	onAlertClick,
}: AlertsTableProps) => {
	const [searchTerm, setSearchTerm] = useState('');
	const parentRef = useRef<HTMLDivElement>(null);

	const serviceNameById = useMemo(() => createServiceNameLookup(services), [services]);
	const filteredAlerts = useMemo(() => filterAlerts(alerts, searchTerm), [alerts, searchTerm]);

	const { sortField, sortDirection, sortedAlerts, handleSort } = useAlertSorting(filteredAlerts);
	const { groupByColumns, setGroupByColumns, flatRows, toggleGroup } = useAlertGrouping(sortedAlerts);
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

	const orderedColumns = useMemo(
		() => columnOrder.filter((col) => visibleColumns.includes(col)),
		[columnOrder, visibleColumns]
	);

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
				/>
			</div>

			<div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
				<div className="border-b flex-shrink-0">
					<Table>
						<TableHeader>
							<TableRow className="h-8">
								{onSelectAlerts && (
									<TableHead className="w-10 h-8 py-1 px-2">
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
									if (column === 'actions') {
										return (
											<TableHead key={column} className="w-24 h-8 py-1 px-2 text-xs">
												<div className="flex items-center justify-between">
													<span>{COLUMN_LABELS[column]}</span>
													{onTableSettingsClick && (
														<Button
															variant="outline"
															size="icon"
															className="h-6 w-6 ml-auto rounded-full"
															onClick={onTableSettingsClick}
															title="Table settings"
														>
															<Settings className="h-3.5 w-3.5" />
														</Button>
													)}
												</div>
											</TableHead>
										);
									}
									if (
										['alertName', 'status', 'tag', 'startsAt', 'summary', 'type'].includes(column)
									) {
										return (
											<SortableHeader
												key={column}
												column={column as AlertSortField}
												label={COLUMN_LABELS[column]}
												sortField={sortField}
												sortDirection={sortDirection}
												onSort={handleSort}
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
							/>
						))}
					</div>

					<div ref={parentRef} className="overflow-auto h-full w-full relative">
						{isLoading ? (
							<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
								Loading alerts...
							</div>
						) : flatRows.length === 0 ? (
							<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
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
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
