import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Activity, Plug, TriangleAlert, WrapText } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AlertsEmptyState } from './AlertsEmptyState';
import {
	ACTIONS_COLUMN,
	ACTIONS_COLUMN_WIDTH,
	COLUMN_LABELS,
	COLUMN_MIN_WIDTHS,
	COLUMN_WIDTHS,
	DEFAULT_COLUMN_ORDER,
	DEFAULT_VISIBLE_COLUMNS,
	SELECT_COLUMN_WIDTH,
	TABLE_HEAD_CLASSES,
} from './AlertsTable.constants';
import { AlertSortField, AlertsTableProps } from './AlertsTable.types';
import { filterAlerts } from './AlertsTable.utils';
import { ColumnSettingsDropdown } from './ColumnSettingsDropdown';
import { GroupByControls } from './GroupByControls';
import { useAlertGrouping, useAlertSelection, useAlertSorting, useDragSelection, useStickyHeaders } from './hooks';
import { SearchBar } from './SearchBar';
import { SortableHeader } from './SortableHeader';
import { StickyGroupHeader } from './StickyGroupHeader';
import { TimeFilter, createEmptyTimeRange, isTimeRangeEmpty } from './TimeFilter';
import { VirtualizedAlertList } from './VirtualizedAlertList';

// Icon-only headers for the narrow icon-only columns; the column name stays in the
// header tooltip.
const HEADER_ICONS: Record<string, ReactNode> = {
	type: <Plug className="h-3.5 w-3.5" />,
	severity: <TriangleAlert className="h-3.5 w-3.5" />,
	status: <Activity className="h-3.5 w-3.5" />,
};

export const AlertsTable = ({
	alerts,
	onSilenceAlert,
	onUnsilenceAlert,
	onDeleteAlert,
	onUnresolveAlert,
	onSelectAlerts,
	selectedAlerts = [],
	isLoading = false,
	className,
	visibleColumns = DEFAULT_VISIBLE_COLUMNS,
	columnOrder = DEFAULT_COLUMN_ORDER,
	onAlertClick,
	activeAlertId = null,
	tagKeyColumnLabels = {},
	groupByColumns: controlledGroupBy,
	onGroupByChange,
	onColumnToggle,
	tagKeys = [],
	searchTerm,
	onSearchTermChange,
	timeRange,
	onTimeRangeChange,
	isResolved = false,
	renderToolbar = true,
	severityColors = false,
	heading,
}: AlertsTableProps) => {
	const parentRef = useRef<HTMLDivElement>(null);

	// Expanded rows: cell content wraps onto new lines (full name/summary/labels)
	// instead of truncating to a single line.
	const [expandRows, setExpandRows] = useState(false);

	const filteredAlerts = useMemo(() => filterAlerts(alerts, searchTerm), [alerts, searchTerm]);

	const allColumnLabels = useMemo(() => ({ ...COLUMN_LABELS, ...tagKeyColumnLabels }), [tagKeyColumnLabels]);

	const { sortField, sortDirection, sortedAlerts, handleSort } = useAlertSorting(filteredAlerts);
	const { groupByColumns, setGroupByColumns, flatRows, toggleGroup, expandAll, collapseAll } = useAlertGrouping(
		sortedAlerts,
		allColumnLabels,
		controlledGroupBy,
		onGroupByChange
	);
	const { handleSelectAll, handleSelectAlert } = useAlertSelection({ sortedAlerts, selectedAlerts, onSelectAlerts });
	const { isDragging, handleDragStart, handleDragEnter, handleDragEnd } = useDragSelection({
		selectedAlerts,
		onSelectAlerts,
	});

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

	// Row heights change when toggling expanded rows; re-measure everything.
	useEffect(() => {
		virtualizer.measure();
	}, [expandRows, virtualizer]);

	const virtualItems = virtualizer.getVirtualItems();
	const activeStickyHeaders = useStickyHeaders({ flatRows, groupByColumns, virtualItems, virtualizer });

	const orderedColumns = useMemo(() => {
		const filtered = columnOrder.filter((col) => col !== ACTIONS_COLUMN && visibleColumns.includes(col));
		return [...filtered, ACTIONS_COLUMN];
	}, [columnOrder, visibleColumns]);

	// Floor width for the table: the sum of the visible columns' minimums. Narrower
	// panes get a horizontal scrollbar instead of columns crushing each other.
	const tableMinWidth = useMemo(() => {
		const columns = onSelectAlerts ? ['select', ...orderedColumns] : orderedColumns;
		return columns.reduce((sum, col) => sum + (COLUMN_MIN_WIDTHS[col] ?? COLUMN_MIN_WIDTHS.default), 0);
	}, [orderedColumns, onSelectAlerts]);

	const hasActiveTimeFilter = timeRange && !isTimeRangeEmpty(timeRange);

	return (
		<div className={cn('flex flex-col h-full', className)}>
			{renderToolbar && (
				<div className="mb-2 flex items-center gap-2">
					<div className="flex-1">
						<SearchBar searchTerm={searchTerm} onSearchChange={onSearchTermChange} />
					</div>
					{onTimeRangeChange && (
						<TimeFilter value={timeRange ?? createEmptyTimeRange()} onChange={onTimeRangeChange} />
					)}
				</div>
			)}

			{!isLoading && alerts.length === 0 && !hasActiveTimeFilter && !searchTerm ? (
				<AlertsEmptyState />
			) : (
				<div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
					{heading && (
						<div className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0 bg-muted/30">
							{heading}
						</div>
					)}
					{/* Header and body share this horizontal scroller: when the pane is narrower
					    than the table's minimum width they scroll sideways together, instead of the
					    auto-width summary column silently collapsing to zero. */}
					<div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
						<div className="flex h-full flex-col" style={{ minWidth: tableMinWidth }}>
							{/* overflow-hidden + stable gutter mirrors the body scrollport's reserved
							    scrollbar gutter (see below) so header and body columns stay aligned on
							    classic-scrollbar systems. */}
							<div
								className="border-b flex-shrink-0 overflow-hidden"
								style={{ scrollbarGutter: 'stable' }}
							>
								<Table className="table-fixed w-full">
									<TableHeader>
										<TableRow className="h-8">
											{onSelectAlerts && (
												<TableHead
													className={TABLE_HEAD_CLASSES}
													style={{
														width: SELECT_COLUMN_WIDTH,
														minWidth: SELECT_COLUMN_WIDTH,
														maxWidth: SELECT_COLUMN_WIDTH,
													}}
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
															className={`${TABLE_HEAD_CLASSES} text-xs`}
															style={{
																width: ACTIONS_COLUMN_WIDTH,
																minWidth: ACTIONS_COLUMN_WIDTH,
																maxWidth: ACTIONS_COLUMN_WIDTH,
															}}
														>
															<div className="flex items-center justify-end gap-2 min-w-0">
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			className={cn(
																				'h-6 w-6',
																				expandRows && 'bg-muted text-primary'
																			)}
																			onClick={() =>
																				setExpandRows((prev) => !prev)
																			}
																			aria-label={
																				expandRows
																					? 'Collapse rows'
																					: 'Expand rows'
																			}
																			aria-pressed={expandRows}
																		>
																			<WrapText className="h-3.5 w-3.5" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>
																		{expandRows
																			? 'Collapse rows'
																			: 'Expand rows to show full content'}
																	</TooltipContent>
																</Tooltip>
																<GroupByControls
																	groupByColumns={groupByColumns}
																	onGroupByChange={setGroupByColumns}
																	availableColumns={visibleColumns}
																	columnLabels={allColumnLabels}
																	onExpandAll={expandAll}
																	onCollapseAll={collapseAll}
																/>
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
													[
														'alertName',
														'severity',
														'status',
														'startsAt',
														'summary',
														'type',
														'owner',
													].includes(column)
												) {
													return (
														<SortableHeader
															key={column}
															column={column as AlertSortField}
															label={allColumnLabels[column]}
															labelIcon={HEADER_ICONS[column]}
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

								{/* Stable gutter: non-overlay scrollbars otherwise shrink the rows relative
							    to the header, drifting the auto-width columns by the scrollbar width. */}
								<div
									ref={parentRef}
									className="overflow-y-auto overflow-x-hidden h-full w-full relative"
									style={{ scrollbarGutter: 'stable' }}
								>
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
											expandRows={expandRows}
											onToggleGroup={toggleGroup}
											onSelectAlert={handleSelectAlert}
											onAlertClick={onAlertClick}
											activeAlertId={activeAlertId}
											onSilenceAlert={onSilenceAlert}
											onUnsilenceAlert={onUnsilenceAlert}
											onDeleteAlert={onDeleteAlert}
											onUnresolveAlert={onUnresolveAlert}
											onSelectAlerts={onSelectAlerts}
											columnLabels={allColumnLabels}
											isResolved={isResolved}
											severityColors={severityColors}
											isDragging={isDragging}
											onDragStart={handleDragStart}
											onDragEnter={handleDragEnter}
											onDragEnd={() => handleDragEnd(handleSelectAlert)}
										/>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
