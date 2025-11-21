import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { AlertRow } from './AlertRow';
import { AlertsEmptyState } from './AlertsEmptyState';
import { COLUMN_LABELS, DEFAULT_COLUMN_ORDER, DEFAULT_VISIBLE_COLUMNS } from './AlertsTable.constants';
import { AlertSortField, AlertsTableProps } from './AlertsTable.types';
import { createServiceNameLookup, filterAlerts, flattenGroups, groupAlerts, sortAlerts } from './AlertsTable.utils';
import { GroupByControls } from './GroupByControls';
import { SearchBar } from './SearchBar';
import { SortableHeader } from './SortableHeader';

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
	const [sortField, setSortField] = useState<AlertSortField>('startsAt');
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
	const [groupByColumns, setGroupByColumns] = useState<string[]>([]);
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

	const parentRef = useRef<HTMLDivElement>(null);

	const serviceNameById = useMemo(() => createServiceNameLookup(services), [services]);

	const filteredAlerts = useMemo(() => filterAlerts(alerts, searchTerm), [alerts, searchTerm]);

	const sortedAlerts = useMemo(() => {
		if (!sortField) return filteredAlerts;
		return sortAlerts(filteredAlerts, sortField, sortDirection);
	}, [filteredAlerts, sortField, sortDirection]);

	const groupedData = useMemo(() => {
		if (groupByColumns.length === 0) return [];
		return groupAlerts(sortedAlerts, groupByColumns);
	}, [sortedAlerts, groupByColumns]);

	const flatRows = useMemo(() => {
		if (groupByColumns.length === 0) {
			return sortedAlerts.map((alert) => ({ type: 'leaf' as const, alert }));
		}
		return flattenGroups(groupedData, expandedGroups);
	}, [sortedAlerts, groupedData, expandedGroups, groupByColumns]);

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

	const handleSort = (field: AlertSortField) => {
		if (sortField === field) {
			setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
		} else {
			setSortField(field);
			setSortDirection(field === 'startsAt' ? 'desc' : 'asc');
		}
	};

	const handleSelectAll = () => {
		if (onSelectAlerts) {
			if (selectedAlerts.length === sortedAlerts.length) {
				onSelectAlerts([]);
			} else {
				onSelectAlerts(sortedAlerts);
			}
		}
	};

	const handleSelectAlert = (alert: (typeof alerts)[0]) => {
		if (onSelectAlerts) {
			const isSelected = selectedAlerts.some((a) => a.id === alert.id);
			if (isSelected) {
				onSelectAlerts(selectedAlerts.filter((a) => a.id !== alert.id));
			} else {
				onSelectAlerts([...selectedAlerts, alert]);
			}
		}
	};

	const toggleGroup = (key: string) => {
		const newExpanded = new Set(expandedGroups);
		if (newExpanded.has(key)) {
			newExpanded.delete(key);
		} else {
			newExpanded.add(key);
		}
		setExpandedGroups(newExpanded);
	};

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

				<div ref={parentRef} className="overflow-auto flex-1 min-h-0 relative">
					{isLoading ? (
						<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
							Loading alerts...
						</div>
					) : flatRows.length === 0 ? (
						<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
							{searchTerm ? 'No alerts found matching your search.' : 'No alerts found.'}
						</div>
					) : (
						<div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
							<Table className="w-full">
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
													<div
														className="flex items-center h-8 border-b bg-muted/30 hover:bg-muted/50 px-2 cursor-pointer"
														style={{ paddingLeft: `${item.level * 24 + 8}px` }}
														onClick={() => toggleGroup(item.key)}
													>
														<Button
															variant="ghost"
															size="icon"
															className="h-6 w-6 p-0 mr-2"
														>
															{item.isExpanded ? (
																<ChevronDown className="h-4 w-4" />
															) : (
																<ChevronRight className="h-4 w-4" />
															)}
														</Button>
														<span className="font-medium text-sm mr-2 text-muted-foreground">
															{COLUMN_LABELS[item.field] || item.field}:
														</span>
														<span className="font-medium text-sm mr-2">{item.value}</span>
														<Badge variant="secondary" className="h-5 px-1.5 text-xs rounded-sm">
															{item.count}
														</Badge>
													</div>
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
													onSelectAlert={handleSelectAlert}
													onAlertClick={onAlertClick}
													onDismissAlert={onDismissAlert}
													onUndismissAlert={onUndismissAlert}
													onDeleteAlert={onDeleteAlert}
													onSelectAlerts={onSelectAlerts}
												/>
											</div>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
