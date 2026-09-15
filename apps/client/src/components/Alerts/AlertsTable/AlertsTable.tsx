import { Checkbox } from '@/components/ui/checkbox';
import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Activity, Plug, TriangleAlert, Wrench } from 'lucide-react';
import { Fragment, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
	isResizableColumn,
	SELECT_COLUMN_WIDTH,
	TABLE_HEAD_CLASSES,
} from './AlertsTable.constants';
import { AlertSortField, AlertsTableProps } from './AlertsTable.types';
import { IncidentSummary } from '@OpsiMate/shared';
import { filterAlerts } from './AlertsTable.utils';
import { ColumnSettingsDropdown } from './ColumnSettingsDropdown';
import { GroupByControls } from './GroupByControls';
import {
	useAlertGrouping,
	useAlertKeyboardNav,
	useIncidentFolding,
	useAlertSelection,
	useAlertSorting,
	useColumnResize,
	useContentColumnWidths,
	useDragAutoScroll,
	useDragSelection,
	useStickyHeaders,
} from './hooks';
import { SearchBar } from './SearchBar';
import { SortableHeader } from './SortableHeader';
import { StickyGroupHeader } from './StickyGroupHeader';
import { TimeFilter, createEmptyTimeRange, isTimeRangeEmpty } from './TimeFilter';
import { VirtualizedAlertList } from './VirtualizedAlertList';

// How long the container width must hold still before columns redistribute: longer
// than one animation frame (so a sliding sidebar coalesces into one commit), short
// enough that the settle after the gesture reads as immediate.
const RESIZE_SETTLE_MS = 100;

// Stable empty map for tables rendered without incident data (identity matters: a fresh
// Map per render would re-run the folding memo every time).
const EMPTY_INCIDENTS: Map<number, IncidentSummary> = new Map();

// Icon-only headers for the narrow icon-only columns; the column name stays in the
// header tooltip.
const HEADER_ICONS: Record<string, ReactNode> = {
	type: <Plug className="h-3.5 w-3.5" />,
	severity: <TriangleAlert className="h-3.5 w-3.5" />,
	fix: <Wrench className="h-3.5 w-3.5" />,
	status: <Activity className="h-3.5 w-3.5" />,
};

export const AlertsTable = ({
	alerts,
	onEndReached,
	sortField: controlledSortField,
	sortDirection: controlledSortDirection,
	onSortChange,
	groupSummaryByKey,
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
	incidentsById,
	onOpenIncident,
	activeIncidentId = null,
	onEditIncident,
	onUngroupIncident,
	onRemoveFromIncident,
	tagKeyColumnLabels = {},
	groupByColumns: controlledGroupBy,
	onGroupByChange,
	onColumnToggle,
	onColumnOrderChange,
	columnWidths = {},
	onColumnWidthsChange,
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
	// The single scroll container (both axes): the virtualizer's scroll element and the
	// width reference for content-aware column sizing.
	const scrollerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	// Ref CALLBACK (not a mount effect): the scroller node is torn down and recreated
	// when the view flips through the empty state or the tab switches, and a
	// once-on-mount observer would keep watching the dead node — containerWidth then
	// sticks at 0/stale and the content columns silently fall back to their static
	// classes. The callback re-attaches the observer to whichever node is current.
	const resizeObserverRef = useRef<ResizeObserver | null>(null);
	// Pending settle-commit for the observer below; cleared on re-attach so a timer
	// from a torn-down scroller can't commit that dead element's width.
	const settleTimerRef = useRef<number | null>(null);
	// useCallback([]): a ref callback with fresh identity re-runs on EVERY render
	// (React detaches with null, re-attaches) — which would tear down the observer
	// and cancel the pending settle timer exactly when a sidebar toggle re-renders
	// the table mid-animation. Stable identity limits runs to real node changes.
	// Everything captured is a ref or a setState, so the empty deps are sound.
	const observeScroller = useCallback((el: HTMLDivElement | null) => {
		scrollerRef.current = el;
		resizeObserverRef.current?.disconnect();
		resizeObserverRef.current = null;
		if (settleTimerRef.current !== null) {
			window.clearTimeout(settleTimerRef.current);
			settleTimerRef.current = null;
		}
		if (el) {
			// The first measurement of each observed element is always accepted:
			// containerWidth survives in React state across scroller remounts (tab
			// switches, empty-state flips), and a new element measuring within the
			// damper's threshold of the STALE value must not be rejected into
			// distributing column widths from the previous element's geometry.
			let measured = false;
			const observer = new ResizeObserver((entries) => {
				const width = entries[0]?.contentRect.width ?? 0;
				if (!measured) {
					measured = true;
					setContainerWidth(width);
					return;
				}
				// Trailing settle-debounce: a sidebar toggle animates the width over
				// ~300ms of per-frame resize events, and committing every step
				// re-renders every visible row once per step — the whole toggle jank.
				// Waiting until events stop costs one re-render per gesture; until it
				// fires the columns keep their widths and the filler column absorbs
				// the difference.
				if (settleTimerRef.current !== null) {
					window.clearTimeout(settleTimerRef.current);
				}
				settleTimerRef.current = window.setTimeout(() => {
					settleTimerRef.current = null;
					// Damper against measure feedback: sub-scrollbar-width deltas are
					// noise from scrollbar/border toggles, and reacting to them re-runs
					// the content-aware column sizing for no visual gain (and can feed
					// back: width change -> columns recompute -> overflow flips ->
					// width change). The scroller reserves its scrollbar gutter
					// (scrollbar-gutter: stable below) so these deltas shouldn't occur
					// at all; this is the backstop.
					setContainerWidth((prev) => (Math.abs(width - prev) < 16 && prev !== 0 ? prev : width));
				}, RESIZE_SETTLE_MS);
			});
			observer.observe(el);
			resizeObserverRef.current = observer;
		}
	}, []);

	const filteredAlerts = useMemo(() => filterAlerts(alerts, searchTerm), [alerts, searchTerm]);

	const allColumnLabels = useMemo(() => ({ ...COLUMN_LABELS, ...tagKeyColumnLabels }), [tagKeyColumnLabels]);

	const { sortField, sortDirection, sortedAlerts, handleSort } = useAlertSorting(
		filteredAlerts,
		controlledSortField,
		controlledSortDirection,
		onSortChange
	);
	const {
		groupByColumns,
		setGroupByColumns,
		flatRows: groupedRows,
		toggleGroup,
		expandAll,
		collapseAll,
	} = useAlertGrouping(sortedAlerts, allColumnLabels, controlledGroupBy, onGroupByChange);
	// When server summaries are supplied, group headers show the TRUE totals over the
	// full matching set instead of counting only the loaded page. Same length and keys,
	// so the virtualizer and sticky headers are unaffected.
	const summarizedRows = useMemo(() => {
		if (!groupSummaryByKey || groupSummaryByKey.size === 0) return groupedRows;
		return groupedRows.map((item) => {
			if (item.type !== 'group') return item;
			const summary = groupSummaryByKey.get(item.key);
			return summary ? { ...item, count: summary.count, groupStatus: summary.status } : item;
		});
	}, [groupedRows, groupSummaryByKey]);
	// Incident folding runs LAST, over the filtered/sorted/grouped rows: the folder sits
	// where its best member would have, and folds only members visible under the current
	// filters (see useIncidentFolding).
	const { foldedRows: flatRows, toggleIncident } = useIncidentFolding(
		summarizedRows,
		incidentsById ?? EMPTY_INCIDENTS
	);
	const { allSelected, handleSelectAll, handleSelectAlert } = useAlertSelection({
		sortedAlerts,
		selectedAlerts,
		onSelectAlerts,
	});
	const { isDragging, handleDragStart, handleDragEnter, handleDragEnd } = useDragSelection({
		selectedAlerts,
		onSelectAlerts,
	});

	// Alert lookup for the auto-scroll hook: rows revealed by scrolling under a held
	// pointer are selected by id (mouseenter doesn't re-fire on scroll).
	const alertsById = useMemo(() => new Map(sortedAlerts.map((alert) => [alert.id, alert])), [sortedAlerts]);
	const handleDragOverAlertId = useCallback(
		(alertId: string) => {
			const alert = alertsById.get(alertId);
			if (alert) handleDragEnter(alert);
		},
		[alertsById, handleDragEnter]
	);
	useDragAutoScroll({ isDragging, scrollElementRef: scrollerRef, onDragOverAlertId: handleDragOverAlertId });

	// The scroll element also contains the sticky column header above the list, so the
	// virtualizer's window mapping runs one header-height "late" — far less than the
	// 5-row overscan, so no visible gap. useStickyHeaders' anchor math is exact: a row
	// counts as top-visible once its bottom clears the pinned header, which is
	// item.start + item.size > scrollTop in list coordinates.
	const virtualizer = useVirtualizer({
		count: flatRows.length,
		getScrollElement: () => scrollerRef.current,
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

	// ArrowUp/ArrowDown move the details-sidebar selection through the rows.
	useAlertKeyboardNav({ flatRows, activeAlertId, onAlertClick, virtualizer, scrollerRef });

	const virtualItems = virtualizer.getVirtualItems();

	// Infinite scroll. onEndReached is defined only while more pages exist (the parent
	// passes undefined once the loaded set is complete), so its presence IS "there is
	// more to load". Two ways to ask for the next page:
	//
	//  - Scrollable list: fire when the user reaches within NEAR_BOTTOM_PX of the bottom.
	//    A render-based trigger ("last row in the virtual window") can't be used — overscan
	//    keeps the last row permanently rendered and chain-loads to the whole dataset.
	//
	//  - NON-scrollable list while more pages exist: fetch the next page immediately. This
	//    is the recovery path. The server query suspends the status filter, so status is
	//    narrowed client-side over the loaded page; if the loaded page happens to hold only
	//    a screenful of status-matching rows (e.g. Active pinned to Firing while the newest
	//    500 are almost all silenced), the list can't scroll and a scroll-only trigger would
	//    strand every matching alert past page 1. Auto-fetching pulls pages until the
	//    viewport fills or the data is exhausted (onEndReached becomes undefined). It's
	//    bounded — fetchNextPage dedupes, and the effect re-runs per appended page — so it
	//    can't chain-load a scrollable list.
	useEffect(() => {
		if (!onEndReached) return;
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const NEAR_BOTTOM_PX = 400;
		const isScrollable = () => scroller.scrollHeight > scroller.clientHeight + 1;
		const maybeFire = () => {
			if (!onEndReached) return;
			if (!isScrollable()) {
				// Auto-fetch on a non-scrollable list is the FLAT-view recovery path
				// (client-side status narrowing can leave a page too short to scroll).
				// In grouped mode a short list is the NORMAL collapsed-headers state —
				// headers carry true totals from the server summaries — and auto-fetching
				// here would chain-load the entire dataset page by page.
				if (groupByColumns.length === 0) {
					onEndReached();
				}
				return;
			}
			if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - NEAR_BOTTOM_PX) {
				onEndReached();
			}
		};
		maybeFire();
		scroller.addEventListener('scroll', maybeFire, { passive: true });
		return () => scroller.removeEventListener('scroll', maybeFire);
	}, [onEndReached, flatRows.length, groupByColumns.length]);
	const activeStickyHeaders = useStickyHeaders({ flatRows, groupByColumns, virtualItems, virtualizer });

	const orderedColumns = useMemo(() => {
		const filtered = columnOrder.filter((col) => col !== ACTIONS_COLUMN && visibleColumns.includes(col));
		return [...filtered, ACTIONS_COLUMN];
	}, [columnOrder, visibleColumns]);

	// The actions header holds the group-by button, plus the column-settings button when
	// enabled — the column must widen with it or the extra button overflows the fixed
	// <th> onto the neighboring column's header text.
	const actionsColumnWidth = onColumnToggle ? ACTIONS_COLUMN_WIDTH_WITH_SETTINGS : ACTIONS_COLUMN_WIDTH;

	// User-dragged widths: the saved map plus the in-flight drag overlaid. Live drag
	// state stays LOCAL to this table (the dashboard state gets one commit per gesture),
	// so only the table being dragged re-renders while the mouse moves.
	const { liveWidths, resizingColumn, startResize, resetColumn, nudgeColumn } = useColumnResize({
		columnWidths,
		onColumnWidthsChange,
	});
	const manualWidths = useMemo(() => ({ ...columnWidths, ...liveWidths }), [columnWidths, liveWidths]);

	// Summary is the table's one flexible column. When it's hidden — or pinned to a
	// manual width (live drags included), which takes it out of the flexible role — an
	// empty filler column before ACTIONS absorbs the leftover width instead; otherwise
	// the browser hands the surplus to a data column (huge whitespace) or stretches
	// every fixed column. AlertRow renders the same filler under the same condition
	// (its width map only ever carries summary when it's manually sized), or the
	// header and row layouts misalign.
	const needsFillerColumn = !orderedColumns.includes('summary') || manualWidths['summary'] !== undefined;

	// Pixel widths for the content-sized columns (alert name + tags): wide enough that
	// their longest value fits, no wider. Empty until the container is first measured —
	// static width classes cover that frame. containerWidth is the scroller's content
	// box (ResizeObserver contentRect), which already excludes any classic vertical
	// scrollbar — so the budget is exactly the width the columns can really use.
	// Manually-resized columns are excluded from the automatic sizing and claim their
	// dragged pixels instead.
	const contentColumnWidths = useContentColumnWidths({
		alerts: sortedAlerts,
		orderedColumns,
		columnLabels: allColumnLabels,
		containerWidth,
		hasSelectColumn: !!onSelectAlerts,
		actionsColumnWidthPx: parseInt(actionsColumnWidth, 10),
		manualWidths,
	});

	// One width map for header and rows: automatic widths, with manual drags on top.
	const effectiveColumnWidths = useMemo(
		() => ({ ...contentColumnWidths, ...manualWidths }),
		[contentColumnWidths, manualWidths]
	);

	// Floor width for the table: the sum of the visible columns' minimums (a manually
	// sized column's floor IS its dragged width — it must not crush). Narrower panes
	// get a horizontal scrollbar instead of columns crushing each other.
	const tableMinWidth = useMemo(() => {
		const columns = onSelectAlerts ? ['select', ...orderedColumns] : orderedColumns;
		return columns.reduce(
			(sum, col) =>
				sum +
				(col === ACTIONS_COLUMN
					? parseInt(actionsColumnWidth, 10)
					: (manualWidths[col] ?? COLUMN_MIN_WIDTHS[col] ?? COLUMN_MIN_WIDTHS.default)),
			0
		);
	}, [orderedColumns, onSelectAlerts, actionsColumnWidth, manualWidths]);

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
					{/* ONE scroller for both axes. The vertical scrollbar renders at the pane's
					    edge OUTSIDE the content, so header and rows span the full content width —
					    no dead strip after the actions column, and the scrollbar is visible
					    regardless of horizontal position. When the pane is narrower than the
					    table's minimum the whole content (header included) scrolls sideways as
					    one, so the auto-width summary column never silently collapses to zero.
					    scrollbar-gutter: stable — the scrollbar's slot at the pane edge is
					    ALWAYS reserved, so the scrollbar appearing/disappearing cannot change
					    the measured content width. Without it, on classic-scrollbar systems a
					    filter click that flips the overflow state feeds back through the width
					    observer (width change -> column widths recompute -> overflow can flip
					    again), visible as a ~15px column jump and wasted re-renders. */}
					<div
						ref={observeScroller}
						className="flex-1 min-h-0 overflow-auto"
						style={{ scrollbarGutter: 'stable' }}
					>
						<div style={{ minWidth: tableMinWidth }}>
							{/* position: sticky pins the column header vertically while it keeps
							    moving horizontally with the columns — it cannot scroll on its own.
							    A raw <table> on purpose: the ui/Table component wraps its table in
							    an overflow-auto div, which turned the header into a second,
							    independently scrollable region with its own scrollbar. Opaque
							    background because rows now scroll underneath it. */}
							{/* data-table-sticky-header: keyboard navigation measures this (and the
							    hanging group copies below) to know how much of the scroller's top is
							    occluded — the virtualizer's own scroll math can't see sticky overlays. */}
							<div className="sticky top-0 z-10" data-table-sticky-header>
								<div className="border-b bg-background">
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
																checked={allSelected}
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
																{/* Pinned to the scroller's right edge: with many columns the
																    content is wider than the pane, and without the pin the
																    group-by/column-toggle buttons sit at the far right of the
																    SCROLLED content — invisible until the user scrolls all the
																    way over. Opaque bg so columns slide underneath. */}
																<TableHead
																	className={`${TABLE_HEAD_CLASSES} text-xs sticky right-0 z-10 bg-background`}
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
																				onColumnOrderChange={
																					onColumnOrderChange
																				}
																				excludeColumns={[ACTIONS_COLUMN]}
																				tagKeys={tagKeys}
																				hasCustomColumnWidths={
																					Object.keys(columnWidths).length > 0
																				}
																				onResetColumnWidths={
																					onColumnWidthsChange
																						? () => onColumnWidthsChange({})
																						: undefined
																				}
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
																	effectiveColumnWidths[column]
																		? { width: effectiveColumnWidths[column] }
																		: undefined
																}
																onResizeStart={startResize}
																onResizeReset={resetColumn}
																onResizeNudge={nudgeColumn}
																resizingColumn={resizingColumn}
															/>
														);
													}
													// Every base column must be listed here — a column the BODY renders
													// (AlertRow's switch) but this list omits gets no header at all, so
													// every header to its right shifts one slot left of its cells.
													if (
														[
															'alertName',
															'severity',
															'fix',
															'status',
															'startsAt',
															'updatedAt',
															'summary',
															'lastComment',
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
																	effectiveColumnWidths[column]
																		? { width: effectiveColumnWidths[column] }
																		: undefined
																}
																onResizeStart={
																	isResizableColumn(column) ? startResize : undefined
																}
																onResizeReset={resetColumn}
																onResizeNudge={nudgeColumn}
																resizingColumn={resizingColumn}
															/>
														);
													}
													return null;
												})}
											</TableRow>
										</TableHeader>
									</table>
								</div>
								{/* Sticky GROUP headers hang off the pinned column header: zero height
								    in flow, absolutely positioned right below it, so their top edge sits
								    at the header's exact rendered bottom — no hardcoded offset to drift
								    when the header's height changes. At rest they cover the real group
								    row pixel-perfectly, and both live in content coordinates, so
								    horizontal scrolling keeps them aligned with the rows. */}
								<div className="relative h-0 z-20">
									{/* Opaque base under the sticky copies: group bars use a translucent
								    bg-muted/50, and at rest the pinned copy sits exactly on the real
								    group row — without this backing the two translucent layers stack
								    and the first group renders darker than every other one. */}
									<div className="absolute left-0 right-0 top-0 bg-background" data-table-sticky-hang>
										{activeStickyHeaders.map((item) => (
											<StickyGroupHeader
												key={`sticky-${item.type === 'group' ? item.key : ''}`}
												item={item}
												onToggle={toggleGroup}
												columnLabels={allColumnLabels}
											/>
										))}
									</div>
								</div>
							</div>

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
									contentColumnWidths={effectiveColumnWidths}
									expandRows={expandRows}
									onToggleGroup={toggleGroup}
									onToggleIncident={toggleIncident}
									onOpenIncident={onOpenIncident}
									activeIncidentId={activeIncidentId}
									onEditIncident={onEditIncident}
									onUngroupIncident={onUngroupIncident}
									onRemoveFromIncident={onRemoveFromIncident}
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
			)}
		</div>
	);
};
