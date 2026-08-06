import { DashboardLayout } from '@/components/DashboardLayout';
import { FilterSidebar } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDashboard } from '@/context/DashboardContext';
import { deserializeTimeRange, serializeTimeRange } from '@/context/DashboardContext.utils';
import { useAlerts, useResolvedAlerts, useDeleteResolvedAlert, useMarkAlertRead } from '@/hooks/queries/alerts';
import {
	useCreateDashboard,
	useDeleteDashboard,
	useGetDashboards,
	useUpdateDashboard,
} from '@/hooks/queries/dashboards';
import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { useServices } from '@/hooks/queries/services';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { Bell, CheckCircle2, ChevronDown, Columns2, LayoutList, Palette, WrapText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AlertsFilterPanel } from '.';
import { AlertDetailsPanel } from './AlertDetails';
import { AlertsSelectionBar } from './AlertsSelectionBar';
import { ConfirmAlertActionDialog, PendingAlertAction } from './ConfirmAlertActionDialog';
import { AlertsTable } from './AlertsTable';
import { AssignmentPane } from './AssignmentPane';
import { VerticalSplit } from './VerticalSplit';
import { ACTIONS_COLUMN } from './AlertsTable/AlertsTable.constants';
import { filterAlerts } from './AlertsTable/AlertsTable.utils';
import { AlertTab } from './AlertsTable/AlertsTable.types';
import { SearchBar } from './AlertsTable/SearchBar';
import { TimeFilter, createEmptyTimeRange } from './AlertsTable/TimeFilter';
import { DashboardHeader } from './DashboardHeader';
import { DashboardSettingsDrawer } from './DashboardSettingsDrawer';
import {
	useAlertActions,
	useAlertsFiltering,
	useAlertsRefresh,
	useAlertTagKeys,
	useColumnManagement,
	useExpandRows,
	useSeverityColors,
} from './hooks';

// Options for the alert-list picker (one dropdown instead of three toggle buttons);
// per-tab counts come from the filtered lists at render time.
const ALERT_TAB_OPTIONS = [
	{ value: AlertTab.Active, label: 'Active', Icon: Bell },
	{ value: AlertTab.Resolved, label: 'Resolved', Icon: CheckCircle2 },
	{ value: AlertTab.All, label: 'All', Icon: LayoutList },
] as const;

const Alerts = () => {
	const { toast } = useToast();
	const { data: alerts = [], isLoading, refetch } = useAlerts();
	const { data: resolvedAlerts = [], isLoading: isLoadingResolved, refetch: refetchResolved } = useResolvedAlerts();
	const { data: services = [] } = useServices();
	const { data: dashboards = [] } = useGetDashboards();
	const createDashboardMutation = useCreateDashboard();
	const updateDashboardMutation = useUpdateDashboard();
	const deleteDashboardMutation = useDeleteDashboard();

	const {
		dashboardState,
		isDirty,
		initialState,
		updateDashboardField,
		markAsClean,
		resetDashboard,
		setShowUnsavedChangesDialog,
		setPendingNavigation,
		setInitialState,
	} = useDashboard();

	const [activeTab, setActiveTab] = useState<AlertTab>(AlertTab.Active);
	const [selectedAlerts, setSelectedAlerts] = useState<Alert[]>([]);
	const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
	const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false);
	const [showDashboardSettings, setShowDashboardSettings] = useState(false);
	const [pendingAction, setPendingAction] = useState<PendingAlertAction | null>(null);
	const [splitByAssignment, setSplitByAssignment] = useState(false);
	const { severityColors, toggleSeverityColors } = useSeverityColors();
	const { expandRows, toggleExpandRows } = useExpandRows();

	const allAlerts = useMemo(() => [...alerts, ...resolvedAlerts], [alerts, resolvedAlerts]);
	const tagKeys = useAlertTagKeys(allAlerts);

	const currentAlertData =
		activeTab === AlertTab.Active ? alerts : activeTab === AlertTab.Resolved ? resolvedAlerts : allAlerts;
	// Sync against both lists (not just the active tab's) so the details panel follows the
	// alert through resolve/unresolve transitions instead of freezing on its pre-action state.
	const syncedSelectedAlert = useMemo(() => {
		if (!selectedAlert) return null;
		const updatedAlert = allAlerts.find((alert) => alert.id === selectedAlert.id);
		return updatedAlert || selectedAlert;
	}, [selectedAlert, allAlerts]);

	const shouldPauseRefresh = showDashboardSettings;

	const {
		lastRefresh: lastRefreshActive,
		isRefreshing: isRefreshingActive,
		handleManualRefresh: handleManualRefreshActive,
	} = useAlertsRefresh(refetch, {
		shouldPause: shouldPauseRefresh || (activeTab !== AlertTab.Active && activeTab !== AlertTab.All),
	});

	const {
		lastRefresh: lastRefreshResolved,
		isRefreshing: isRefreshingResolved,
		handleManualRefresh: handleManualRefreshResolved,
	} = useAlertsRefresh(refetchResolved, {
		shouldPause: shouldPauseRefresh || (activeTab !== AlertTab.Resolved && activeTab !== AlertTab.All),
	});

	const lastRefresh = activeTab === AlertTab.Resolved ? lastRefreshResolved : lastRefreshActive;
	const isRefreshing =
		activeTab === AlertTab.Active
			? isRefreshingActive
			: activeTab === AlertTab.Resolved
				? isRefreshingResolved
				: isRefreshingActive || isRefreshingResolved;
	const handleManualRefresh =
		activeTab === AlertTab.Active
			? handleManualRefreshActive
			: activeTab === AlertTab.Resolved
				? handleManualRefreshResolved
				: () => {
						handleManualRefreshActive();
						handleManualRefreshResolved();
					};

	const { visibleColumns, columnOrder, handleColumnToggle, allColumnLabels, enabledTagKeys } = useColumnManagement({
		tagKeys,
		visibleColumns: dashboardState.visibleColumns,
		columnOrder: dashboardState.columnOrder,
		onVisibleColumnsChange: (columns) =>
			updateDashboardField(
				'visibleColumns',
				columns.filter((col) => col !== ACTIONS_COLUMN)
			),
	});

	// Persist a user-arranged base-column order (tag columns follow the visible list).
	const handleColumnOrderChange = (columns: string[]) => {
		updateDashboardField(
			'columnOrder',
			columns.filter((col) => col !== ACTIONS_COLUMN)
		);
	};

	const handleSaveDashboard = async () => {
		const dashboardData = {
			name: dashboardState.name || 'New Dashboard',
			type: dashboardState.type,
			description: dashboardState.description,
			filters: dashboardState.filters,
			visibleColumns: dashboardState.visibleColumns.filter((col) => col !== ACTIONS_COLUMN),
			columnOrder: dashboardState.columnOrder.filter((col) => col !== ACTIONS_COLUMN),
			query: dashboardState.query,
			groupBy: dashboardState.groupBy,
			timeRange: serializeTimeRange(dashboardState.timeRange),
		};

		try {
			if (dashboardState.id) {
				await updateDashboardMutation.mutateAsync({
					id: dashboardState.id,
					...dashboardData,
				});
			} else {
				const result = await createDashboardMutation.mutateAsync(dashboardData);
				if (result?.id) {
					updateDashboardField('id', result.id);
				}
			}
			markAsClean();
			toast({
				title: 'Dashboard saved',
				description: 'Your changes have been saved successfully.',
			});
		} catch (error) {
			toast({
				title: 'Error saving dashboard',
				description: 'Failed to save dashboard changes',
				variant: 'destructive',
			});
		}
	};

	const handleFilterChange = (newFilters: Record<string, string[]>) => {
		updateDashboardField('filters', newFilters);
	};

	const filteredAlerts = useAlertsFiltering(alerts, {
		filters: dashboardState.filters,
		timeRange: dashboardState.timeRange,
	});
	// The Resolved and All VIEWS run with the status filter suspended — not deleted.
	// Resolved: an active status like Firing/Silenced can never match resolved alerts,
	// so applying it would make the view silently empty. All: the tab's promise is
	// every alert regardless of status, so a status filter picked on Active must not
	// follow the user there. Wiping the filter instead (the old behavior) destroyed
	// the user's stored filter — and dirtied the dashboard — just for peeking at
	// another tab; the stored filters stay intact and Active keeps applying them.
	const statusSuspendedFilters = useMemo(() => {
		const { status: _status, ...rest } = dashboardState.filters;
		return rest;
	}, [dashboardState.filters]);
	const resolvedViewAlerts = useAlertsFiltering(resolvedAlerts, {
		filters: statusSuspendedFilters,
		timeRange: dashboardState.timeRange,
	});
	// Active alerts for the All view — same suspension, all statuses shown.
	const allViewActiveAlerts = useAlertsFiltering(alerts, {
		filters: statusSuspendedFilters,
		timeRange: dashboardState.timeRange,
	});

	// Split the active, filtered alerts by assignment for the side-by-side view.
	const unassignedAlerts = useMemo(() => filteredAlerts.filter((a) => !a.ownerId), [filteredAlerts]);
	const assignedAlerts = useMemo(() => filteredAlerts.filter((a) => !!a.ownerId), [filteredAlerts]);

	// Combined "All" view: active alerts followed by resolved ones tagged so each row can route
	// its own actions. resolvedIds lets shared callbacks tell which list an alert belongs to.
	const resolvedIds = useMemo(() => new Set(resolvedAlerts.map((a) => a.id)), [resolvedAlerts]);
	const filteredAllAlerts = useMemo(
		() => [...allViewActiveAlerts, ...resolvedViewAlerts.map((a) => ({ ...a, isResolved: true }))],
		[allViewActiveAlerts, resolvedViewAlerts]
	);

	const {
		handleSilenceAlert,
		handleUnsilenceAlert,
		handleDeleteAlert,
		handleUnresolveAlert,
		handleSilenceAll,
		handleUnsilenceAll,
		handleAssignOwnerAll,
		handleResolveAll,
		handleCommentAll,
		handleDeleteForeverAll,
	} = useAlertActions();
	const deleteResolvedAlertMutation = useDeleteResolvedAlert();
	const markAlertReadMutation = useMarkAlertRead();

	const handleSilenceAllSelected = async (silencedUntil?: string | null, comment?: string) => {
		await handleSilenceAll(selectedAlerts, () => setSelectedAlerts([]), silencedUntil, comment);
	};

	const handleAssignOwnerAllSelected = async (ownerId: string | null) => {
		await handleAssignOwnerAll(selectedAlerts, ownerId, () => setSelectedAlerts([]));
	};

	const handleResolveAllSelected = async (comment?: string) => {
		setSelectedAlert(null);
		await handleResolveAll(selectedAlerts, () => setSelectedAlerts([]), comment);
	};

	const handleDeleteAllSelected = async () => {
		setSelectedAlert(null);
		await handleDeleteForeverAll(selectedAlerts, () => setSelectedAlerts([]));
	};

	const handleDeleteResolvedAlert = async (alertId: string) => {
		try {
			await deleteResolvedAlertMutation.mutateAsync(alertId);
			toast({ title: 'Alert deleted', description: 'The alert was permanently removed.' });
		} catch (err) {
			toast({
				title: 'Failed to delete alert',
				description: err instanceof Error ? err.message : 'Unknown error',
				variant: 'destructive',
			});
		}
	};

	// Silence, resolve, and delete change alert state in one click from several places, so
	// each one funnels through a confirmation dialog before running.
	const confirmSilenceAlert = (alertId: string) =>
		setPendingAction({
			title: 'Silence this alert?',
			description:
				'The alert stays in the list but stops notifying for the chosen duration. You can unsilence it at any time, and silencing again restarts the timer.',
			confirmLabel: 'Silence',
			withSilenceDuration: true,
			withComment: true,
			commentLabel: 'Silence comment',
			commentPlaceholder: 'Why is this silenced?',
			run: (comment, silencedUntil) => void handleSilenceAlert(alertId, silencedUntil, comment),
		});

	const confirmResolveAlert = (alertId: string) =>
		setPendingAction({
			title: 'Resolve this alert?',
			description: 'The alert moves to the Resolved list. You can unresolve it later if it is still an issue.',
			confirmLabel: 'Resolve',
			withComment: true,
			commentLabel: 'Resolve comment',
			commentPlaceholder: 'What fixed it / why is this resolved?',
			run: (comment) => void handleDeleteAlert(alertId, comment),
		});

	const confirmDeleteResolvedAlert = (alertId: string) =>
		setPendingAction({
			title: 'Delete this alert permanently?',
			description:
				'The alert will be removed for good and will no longer appear in the Resolved list. This cannot be undone.',
			confirmLabel: 'Delete',
			destructive: true,
			run: () => void handleDeleteResolvedAlert(alertId),
		});

	// Combined "All" view: route to the delete confirmation for resolved rows, the resolve
	// confirmation for active ones.
	const confirmDeleteAnyAlert = (alertId: string) => {
		if (resolvedIds.has(alertId)) {
			confirmDeleteResolvedAlert(alertId);
		} else {
			confirmResolveAlert(alertId);
		}
	};

	// Direct (no confirmation dialog), matching the single-row unsilence: it's
	// non-destructive and instantly reversible by silencing again.
	const handleUnsilenceAllSelected = () => void handleUnsilenceAll(selectedAlerts, () => setSelectedAlerts([]));

	const confirmSilenceAllSelected = () =>
		setPendingAction({
			title: `Silence ${selectedAlerts.length} alert${selectedAlerts.length !== 1 ? 's' : ''}?`,
			description:
				'The selected alerts stay in the list but stop notifying for the chosen duration. You can unsilence them at any time, and silencing again restarts the timer.',
			confirmLabel: 'Silence all',
			withSilenceDuration: true,
			withComment: true,
			commentLabel: 'Silence comment',
			commentPlaceholder: 'Why are these silenced?',
			run: (comment, silencedUntil) => void handleSilenceAllSelected(silencedUntil, comment),
		});

	const handleCommentAllSelected = async (comment: string) => {
		await handleCommentAll(selectedAlerts, comment, () => setSelectedAlerts([]));
	};

	const confirmCommentAllSelected = () =>
		setPendingAction({
			title: `Comment on ${selectedAlerts.length} alert${selectedAlerts.length !== 1 ? 's' : ''}?`,
			description: 'The same comment is added to every selected alert, visible in its comments and history.',
			confirmLabel: 'Comment',
			withComment: true,
			requireComment: true,
			commentLabel: 'Comment',
			commentPlaceholder: 'What should the team know about these alerts?',
			run: (comment) => {
				if (comment) void handleCommentAllSelected(comment);
			},
		});

	const confirmResolveAllSelected = () =>
		setPendingAction({
			title: `Resolve ${selectedAlerts.length} alert${selectedAlerts.length !== 1 ? 's' : ''}?`,
			description:
				'The selected alerts move to the Resolved list. You can unresolve them later if needed. An optional comment will be added to every resolved alert.',
			confirmLabel: 'Resolve',
			withComment: true,
			commentLabel: 'Resolve comment',
			commentPlaceholder: 'What fixed it / why is this resolved?',
			run: (comment) => void handleResolveAllSelected(comment),
		});

	// Active-tab alerts table, parameterized by the alert list so it can render full-width
	// or inside one of the split-by-assignment panes without duplicating the prop wiring.
	const renderActiveAlertsTable = (list: Alert[]) => (
		<AlertsTable
			alerts={list}
			services={services}
			onSilenceAlert={confirmSilenceAlert}
			onUnsilenceAlert={handleUnsilenceAlert}
			onDeleteAlert={confirmResolveAlert}
			onSelectAlerts={setSelectedAlerts}
			selectedAlerts={selectedAlerts}
			isLoading={isLoading}
			visibleColumns={visibleColumns}
			columnOrder={columnOrder}
			onAlertClick={handleAlertClick}
			activeAlertId={syncedSelectedAlert?.id ?? null}
			tagKeyColumnLabels={allColumnLabels}
			groupByColumns={dashboardState.groupBy}
			onGroupByChange={(cols) => updateDashboardField('groupBy', cols)}
			onColumnToggle={handleColumnToggle}
			onColumnOrderChange={handleColumnOrderChange}
			tagKeys={tagKeys}
			timeRange={dashboardState.timeRange}
			onTimeRangeChange={(range) => updateDashboardField('timeRange', range)}
			searchTerm={dashboardState.query}
			onSearchTermChange={(term) => updateDashboardField('query', term)}
			renderToolbar={false}
			severityColors={severityColors}
			expandRows={expandRows}
		/>
	);

	const handleNewDashboard = () => {
		if (isDirty) {
			setPendingNavigation(() => resetDashboard);
			setShowUnsavedChangesDialog(true);
		} else {
			resetDashboard();
		}
	};

	const handleDashboardSelect = (dashboard: Dashboard) => {
		const loadDashboard = () => {
			setInitialState({
				id: dashboard.id,
				name: dashboard.name,
				type: dashboard.type,
				description: dashboard.description || '',
				visibleColumns: dashboard.visibleColumns || [],
				filters: dashboard.filters || {},
				columnOrder: dashboard.columnOrder || [],
				groupBy: dashboard.groupBy || [],
				query: dashboard.query || '',
				timeRange: deserializeTimeRange(dashboard.timeRange),
			});
		};

		if (isDirty) {
			setPendingNavigation(() => loadDashboard);
			setShowUnsavedChangesDialog(true);
		} else {
			loadDashboard();
		}
	};

	const handleDeleteDashboard = async () => {
		if (!dashboardState.id) return;

		try {
			await deleteDashboardMutation.mutateAsync(dashboardState.id);
			resetDashboard();
			setShowDashboardSettings(false);
		} catch (error) {
			toast({
				title: 'Error deleting dashboard',
				description: 'Failed to delete dashboard',
				variant: 'destructive',
			});
		}
	};

	const handleAlertClick = (alert: Alert) => {
		// Opening an unread (active) alert marks it as read, un-bolding its row. The transient
		// isResolved flag (set on resolved rows in the All view) is the guard here — an id-based
		// check would wrongly skip active alerts that were resolved once and re-fired.
		if (alert.isRead === false && !alert.isResolved) {
			markAlertReadMutation.mutate(alert.id);
		}
		setSelectedAlert((prev) => (prev?.id === alert.id ? null : alert));
	};

	// Per-tab counts for the alert-list picker; the dropdown shows every tab's count so
	// switching isn't needed just to see how many resolved/all alerts there are. The
	// search term is applied too — AlertsTable filters by it after the sidebar/time
	// filters, and the counts must agree with the rows actually shown.
	const tabCounts: Record<AlertTab, number> = useMemo(
		() => ({
			[AlertTab.Active]: filterAlerts(filteredAlerts, dashboardState.query).length,
			// Resolved and All mirror their views, which suspend the status filter (see above).
			[AlertTab.Resolved]: filterAlerts(resolvedViewAlerts, dashboardState.query).length,
			[AlertTab.All]: filterAlerts(filteredAllAlerts, dashboardState.query).length,
		}),
		[filteredAlerts, resolvedViewAlerts, filteredAllAlerts, dashboardState.query]
	);
	return (
		<DashboardLayout>
			<div className="flex h-full">
				<FilterSidebar
					collapsed={filterPanelCollapsed}
					onToggle={() => setFilterPanelCollapsed(!filterPanelCollapsed)}
				>
					<AlertsFilterPanel
						alerts={currentAlertData}
						filters={dashboardState.filters}
						onFilterChange={handleFilterChange}
						collapsed={filterPanelCollapsed}
						tagKeys={tagKeys}
						hideStatusFilter={activeTab !== AlertTab.Active}
					/>
				</FilterSidebar>

				<div className="flex-1 flex min-h-0 overflow-hidden">
					<div className={cn('flex flex-col p-4 min-h-0 transition-all duration-300', 'flex-1 min-w-0')}>
						<div className="shrink-0 mb-4">
							<DashboardHeader
								dashboardName={dashboardState.name}
								onDashboardNameChange={(name) => updateDashboardField('name', name)}
								onDashboardNameBlur={() => {
									if (dashboardState.name && dashboardState.name !== initialState.name) {
										handleSaveDashboard();
									}
								}}
								isDirty={isDirty}
								onSave={handleSaveDashboard}
								onSettingsClick={() => setShowDashboardSettings(true)}
								isRefreshing={isRefreshing}
								lastRefresh={lastRefresh}
								onRefresh={handleManualRefresh}
								dashboards={dashboards}
								onDashboardSelect={handleDashboardSelect}
								onNewDashboard={handleNewDashboard}
								isDraft={!dashboardState.id}
							/>

							<div className="mt-3 flex items-center gap-4">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											className="gap-1.5 shrink-0"
											// Dynamic name: a static label would override the visible text and
											// hide the current view + count from screen readers.
											aria-label={`Choose which alerts to show — currently ${
												ALERT_TAB_OPTIONS.find((option) => option.value === activeTab)?.label ??
												'Active'
											}, ${tabCounts[activeTab]} alerts`}
										>
											{/* All options render stacked in one grid cell (hidden except the
											    current one) so the button keeps the width of the widest option
											    and nothing shifts when switching views. */}
											<span className="grid">
												{ALERT_TAB_OPTIONS.map(({ value, label, Icon }) => (
													<span
														key={value}
														aria-hidden={value !== activeTab}
														className={cn(
															'col-start-1 row-start-1 flex items-center gap-1.5 whitespace-nowrap',
															value !== activeTab && 'invisible'
														)}
													>
														<Icon className="h-4 w-4" />
														<span>{label}</span>
														<span className="text-xs text-muted-foreground tabular-nums">
															{tabCounts[value]}
														</span>
													</span>
												))}
											</span>
											<ChevronDown className="h-3.5 w-3.5 opacity-60" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" className="w-44">
										<DropdownMenuRadioGroup
											value={activeTab}
											onValueChange={(value) => {
												setActiveTab(value as AlertTab);
												setSelectedAlert(null);
												setSelectedAlerts([]);
											}}
										>
											{ALERT_TAB_OPTIONS.map(({ value, label, Icon }) => (
												<DropdownMenuRadioItem key={value} value={value} className="gap-1.5">
													<Icon className="h-4 w-4" />
													<span>{label}</span>
													<span className="ml-auto pl-4 text-xs text-muted-foreground tabular-nums">
														{tabCounts[value]}
													</span>
												</DropdownMenuRadioItem>
											))}
										</DropdownMenuRadioGroup>
									</DropdownMenuContent>
								</DropdownMenu>

								<div className="flex-1 min-w-0">
									<SearchBar
										searchTerm={dashboardState.query}
										onSearchChange={(term) => updateDashboardField('query', term)}
									/>
								</div>

								{activeTab === AlertTab.Active && (
									<Button
										variant={splitByAssignment ? 'default' : 'outline'}
										size="sm"
										onClick={() => setSplitByAssignment((v) => !v)}
										className="gap-1.5 shrink-0"
										title="Split into Unassigned and Assigned"
									>
										<Columns2 className="h-4 w-4" />
										<span className="hidden lg:inline">Split by owner</span>
									</Button>
								)}

								<Button
									variant={severityColors ? 'default' : 'outline'}
									size="sm"
									onClick={toggleSeverityColors}
									className="gap-1.5 shrink-0"
									title="Color rows by severity"
								>
									<Palette className="h-4 w-4" />
									<span className="hidden lg:inline">Severity colors</span>
								</Button>

								<Button
									variant={expandRows ? 'default' : 'outline'}
									size="sm"
									onClick={toggleExpandRows}
									className="gap-1.5 shrink-0"
									title="Expand rows to show full content"
									aria-pressed={expandRows}
								>
									<WrapText className="h-4 w-4" />
									<span className="hidden lg:inline">Expand rows</span>
								</Button>

								<TimeFilter
									value={dashboardState.timeRange ?? createEmptyTimeRange()}
									onChange={(range) => updateDashboardField('timeRange', range)}
								/>
							</div>
						</div>

						{activeTab === AlertTab.Active ? (
							<>
								{splitByAssignment ? (
									<VerticalSplit
										className="flex-1"
										top={
											<AssignmentPane
												title="Unassigned"
												count={unassignedAlerts.length}
												tone="amber"
												isEmpty={unassignedAlerts.length === 0 && !isLoading}
												emptyText="Nothing waiting — all alerts are assigned."
											>
												{renderActiveAlertsTable(unassignedAlerts)}
											</AssignmentPane>
										}
										bottom={
											<AssignmentPane
												title="Assigned"
												count={assignedAlerts.length}
												tone="emerald"
												isEmpty={assignedAlerts.length === 0 && !isLoading}
												emptyText="No alerts assigned yet."
											>
												{renderActiveAlertsTable(assignedAlerts)}
											</AssignmentPane>
										}
									/>
								) : (
									<div
										className={cn(
											'flex-1 min-h-0',
											alerts.length === 0 && !isLoading && 'flex items-center justify-center'
										)}
									>
										{renderActiveAlertsTable(filteredAlerts)}
									</div>
								)}

								<div className="shrink-0">
									<AlertsSelectionBar
										selectedAlerts={selectedAlerts}
										onClearSelection={() => setSelectedAlerts([])}
										onSilenceAll={confirmSilenceAllSelected}
										onUnsilenceAll={handleUnsilenceAllSelected}
										onAssignOwnerAll={handleAssignOwnerAllSelected}
										onResolveAll={confirmResolveAllSelected}
										onCommentAll={confirmCommentAllSelected}
										onDeleteAll={handleDeleteAllSelected}
									/>
								</div>
							</>
						) : activeTab === AlertTab.Resolved ? (
							<div
								className={cn(
									'flex-1 min-h-0',
									// Matches the list the table actually renders, so the empty state
									// centers also when filters (not just an empty source) clear it.
									resolvedViewAlerts.length === 0 &&
										!isLoadingResolved &&
										'flex items-center justify-center'
								)}
							>
								<AlertsTable
									alerts={resolvedViewAlerts}
									services={services}
									onSilenceAlert={undefined}
									onUnsilenceAlert={undefined}
									onDeleteAlert={confirmDeleteResolvedAlert}
									onUnresolveAlert={handleUnresolveAlert}
									onSelectAlerts={undefined}
									selectedAlerts={[]}
									isLoading={isLoadingResolved}
									isResolved={true}
									visibleColumns={visibleColumns}
									columnOrder={columnOrder}
									onAlertClick={handleAlertClick}
									activeAlertId={syncedSelectedAlert?.id ?? null}
									tagKeyColumnLabels={allColumnLabels}
									groupByColumns={dashboardState.groupBy}
									onGroupByChange={(cols) => updateDashboardField('groupBy', cols)}
									onColumnToggle={handleColumnToggle}
									onColumnOrderChange={handleColumnOrderChange}
									tagKeys={tagKeys}
									timeRange={dashboardState.timeRange}
									onTimeRangeChange={(range) => updateDashboardField('timeRange', range)}
									searchTerm={dashboardState.query}
									onSearchTermChange={(term) => updateDashboardField('query', term)}
									renderToolbar={false}
									severityColors={severityColors}
									expandRows={expandRows}
								/>
							</div>
						) : (
							<div
								className={cn(
									'flex-1 min-h-0',
									filteredAllAlerts.length === 0 &&
										!isLoading &&
										!isLoadingResolved &&
										'flex items-center justify-center'
								)}
							>
								<AlertsTable
									alerts={filteredAllAlerts}
									services={services}
									onSilenceAlert={confirmSilenceAlert}
									onUnsilenceAlert={handleUnsilenceAlert}
									onDeleteAlert={confirmDeleteAnyAlert}
									onUnresolveAlert={handleUnresolveAlert}
									onSelectAlerts={undefined}
									selectedAlerts={[]}
									isLoading={isLoading || isLoadingResolved}
									visibleColumns={visibleColumns}
									columnOrder={columnOrder}
									onAlertClick={handleAlertClick}
									activeAlertId={syncedSelectedAlert?.id ?? null}
									tagKeyColumnLabels={allColumnLabels}
									groupByColumns={dashboardState.groupBy}
									onGroupByChange={(cols) => updateDashboardField('groupBy', cols)}
									onColumnToggle={handleColumnToggle}
									onColumnOrderChange={handleColumnOrderChange}
									tagKeys={tagKeys}
									timeRange={dashboardState.timeRange}
									onTimeRangeChange={(range) => updateDashboardField('timeRange', range)}
									searchTerm={dashboardState.query}
									onSearchTermChange={(term) => updateDashboardField('query', term)}
									renderToolbar={false}
									severityColors={severityColors}
									expandRows={expandRows}
								/>
							</div>
						)}
					</div>

					{syncedSelectedAlert &&
						(() => {
							// Data-driven (not tab-driven): resolving an alert while its panel is
							// open flips the panel to resolved mode in place, and unresolving
							// flips it back.
							const selectedIsResolved = resolvedIds.has(syncedSelectedAlert.id);
							return (
								<AlertDetailsPanel
									alert={syncedSelectedAlert}
									isActive={!selectedIsResolved}
									timeRange={dashboardState.timeRange}
									onClose={() => setSelectedAlert(null)}
									onSilence={confirmSilenceAlert}
									onUnsilence={handleUnsilenceAlert}
									onDelete={selectedIsResolved ? confirmDeleteResolvedAlert : confirmResolveAlert}
									onUnresolve={handleUnresolveAlert}
								/>
							);
						})()}
				</div>
			</div>

			<ConfirmAlertActionDialog pending={pendingAction} onClose={() => setPendingAction(null)} />

			<DashboardSettingsDrawer
				open={showDashboardSettings}
				onOpenChange={setShowDashboardSettings}
				dashboardName={dashboardState.name}
				onDashboardNameChange={(name) => updateDashboardField('name', name)}
				dashboardDescription={dashboardState.description}
				onDashboardDescriptionChange={(desc) => updateDashboardField('description', desc)}
				onDelete={handleDeleteDashboard}
				canDelete={!!dashboardState.id}
			/>
		</DashboardLayout>
	);
};

export default Alerts;
