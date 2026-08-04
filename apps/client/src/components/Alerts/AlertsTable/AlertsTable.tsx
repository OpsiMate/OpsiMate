import { Checkbox } from '@/components/ui/checkbox';
import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Activity, Plug, TriangleAlert } from 'lucide-react';
import { Fragment, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AlertsEmptyState } from './AlertsEmptyState';
import {
	ACTIONS_COLUMN,
	ACTIONS_COLUMN_WIDTH,
	ACTIONS_COLUMN_WIDTH_WITH_SETTINGS,
	COLUMN_LABELS,
	COLUMN_MIN_WIDTHS,
	COLUMN_WIDTHS,
	DEFAULT_COLUMN_ORDER,
	DEFAULT_VISIBLE_COLUMNS,
	SELECT_COLUMN_WIDTH,
	TABLE_HEAD_CLASSES,
} from './AlertsTable.constants';
import { AlertSortField, AlertsTableProps } from './AlertsTable.types';
import { filterAlerts, getScrollbarWidth } from './AlertsTable.utils';
import { ColumnSettingsDropdown } from './ColumnSettingsDropdown';
import { GroupByControls } from './GroupByControls';
import {
	useAlertGrouping,
	useAlertSelection,
	useAlertSorting,
	useContentColumnWidths,
	useDragSelection,
	useStickyHeaders,
} from './hooks';
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
	onColumnOrderChange,
	tagKeys = [],
	searchTerm,
	onSearchTermChange,
	timeRange,
	onTimeRangeChange,
	isResolved = false,
	renderToolbar = true,
	severityColors = false,
	// Wrap cell content onto new lines (full name/summary/labels) instead of truncating;
	// owned by the page toolbar so every table on the page follows the same toggle.
	expandRows = false,
	heading,
}: AlertsTableProps) => {
	const parentRef = useRef<HTMLDivElement>(null);

	// Width of the horizontal scroll container, tracked so content-aware column widths
	// can react to window/pane resizes.
	const scrollerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	useEffect(() => {
		const el = scrollerRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => setContainerWidth(entries[0]?.contentRect.width ?? 0));
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

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

	// Summary is the table's one flexible column. When it's hidden, an empty filler
	// column before ACTIONS absorbs the leftover width instead — otherwise the browser
	// hands the surplus to a data column (huge whitespace) or stretches every fixed
	// column. The rows render the same filler (AlertRow) or the layouts misalign.
	const needsFillerColumn = !orderedColumns.includes('summary');

	// The actions header holds the group-by button, plus the column-settings button when
	// enabled — the column must widen with it or the extra button overflows the fixed
	// <th> onto the neighboring column's header text.
	const actionsColumnWidth = onColumnToggle ? ACTIONS_COLUMN_WIDTH_WITH_SETTINGS : ACTIONS_COLUMN_WIDTH;

	// The body scrollport reserves a scrollbar gutter (scrollbar-gutter: stable), so the
	// columns' usable width is the scroller's width minus one classic scrollbar. Budgeting
	// the full width instead (the old behavior) made the table permanently overflow by
	// exactly the gutter on classic-scrollbar systems: an ever-present horizontal
	// scrollbar, and the actions column clipped at the right edge.
	const scrollbarWidth = useMemo(() => getScrollbarWidth(), []);

	// Pixel widths for the content-sized columns (alert name + tags): wide enough that
	// their longest value fits, no wider. Empty until the container is first measured —
	// static width classes cover that frame.
	const contentColumnWidths = useContentColumnWidths({
		alerts: sortedAlerts,
		orderedColumns,
		columnLabels: allColumnLabels,
		containerWidth: Math.max(0, containerWidth - scrollbarWidth),
		hasSelectColumn: !!onSelectAlerts,
		actionsColumnWidthPx: parseInt(actionsColumnWidth, 10),
	});

	// Floor width for the table: the sum of the visible columns' minimums. Narrower
	// panes get a horizontal scrollbar instead of columns crushing each other.
	const tableMinWidth = useMemo(() => {
		const columns = onSelectAlerts ? ['select', ...orderedColumns] : orderedColumns;
		return columns.reduce(
			(sum, col) =>
				sum +
				(col === ACTIONS_COLUMN
					? parseInt(actionsColumnWidth, 10)
					: (COLUMN_MIN_WIDTHS[col] ?? COLUMN_MIN_WIDTHS.default)),
			0
		);
	}, [orderedColumns, onSelectAlerts, actionsColumnWidth]);

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
						<div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0 bg-muted/30">
							{heading}
						</div>
					)}
					{/* Header and body share this horizontal scroller: when the pane is narrower
					    than the table's minimum width they scroll sideways together, instead of the
					    auto-width summary column silently collapsing to zero. The floor adds the
					    reserved scrollbar gutter back so the columns' minimums fit INSIDE the
					    gutter — otherwise the actions column ends clipped by one scrollbar width
					    even when scrolled all the way right. */}
					<div ref={scrollerRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
						<div className="flex h-full flex-col" style={{ minWidth: tableMinWidth + scrollbarWidth }}>
							{/* overflow-hidden + stable gutter mirrors the body scrollport's reserved
							    scrollbar gutter (see below) so header and body columns stay aligned on
							    classic-scrollbar systems. A raw <table> on purpose: the ui/Table
							    component wraps its table in an overflow-auto div, which turned the
							    header into a second, independently scrollable region with its own
							    scrollbar. The header must never scroll on its own — only the shared
							    horizontal scroller above moves it, together with the body. */}
							<div className="border-b shrink-0 overflow-hidden" style={{ scrollbarGutter: 'stable' }}>
								<table className="table-fixed w-full text-sm">
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
														<Fragment key={column}>
															{needsFillerColumn && (
																<TableHead aria-hidden className="p-0" />
															)}
															<TableHead
																className={`${TABLE_HEAD_CLASSES} text-xs`}
																style={{
																	width: actionsColumnWidth,
																	minWidth: actionsColumnWidth,
																	maxWidth: actionsColumnWidth,
																}}
															>
																<div className="flex items-center justify-end gap-2 min-w-0">
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
																			columnOrder={columnOrder}
																			onColumnOrderChange={onColumnOrderChange}
																			excludeColumns={[ACTIONS_COLUMN]}
																			tagKeys={tagKeys}
																		/>
																	)}
																</div>
															</TableHead>
														</Fragment>
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
															style={
																contentColumnWidths[column]
																	? { width: contentColumnWidths[column] }
																	: undefined
															}
														/>
													);
												}
												if (
													[
														'alertName',
														'severity',
														'status',
														'startsAt',
														'updatedAt',
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
															style={
																contentColumnWidths[column]
																	? { width: contentColumnWidths[column] }
																	: undefined
															}
														/>
													);
												}
												return null;
											})}
										</TableRow>
									</TableHeader>
								</table>
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
											contentColumnWidths={contentColumnWidths}
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
											actionsColumnWidth={actionsColumnWidth}
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
