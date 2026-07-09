import { DashboardLayout } from '@/components/DashboardLayout';
import { FilterSidebar } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDashboard } from '@/context/DashboardContext';
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
import { Bell, CheckCircle2, Columns2, LayoutList, Palette } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertsFilterPanel } from '.';
import { AlertDetailsPanel } from './AlertDetails';
import { AlertsSelectionBar } from './AlertsSelectionBar';
import { AlertsTable } from './AlertsTable';
import { AssignmentPane } from './AssignmentPane';
import { VerticalSplit } from './VerticalSplit';
import { ACTIONS_COLUMN } from './AlertsTable/AlertsTable.constants';
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
	useResolvedTabStatusFilterReset,
	useColumnManagement,
	useSeverityColors,
} from './hooks';

const Alerts = () => {
	const navigate = useNavigate();
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
	const [splitByAssignment, setSplitByAssignment] = useState(false);
	const { severityColors, toggleSeverityColors } = useSeverityColors();

	const allAlerts = useMemo(() => [...alerts, ...resolvedAlerts], [alerts, resolvedAlerts]);
	const tagKeys = useAlertTagKeys(allAlerts);

	const currentAlertData =
		activeTab === AlertTab.Active ? alerts : activeTab === AlertTab.Resolved ? resolvedAlerts : allAlerts;
	const syncedSelectedAlert = useMemo(() => {
		if (!selectedAlert) return null;
		const updatedAlert = currentAlertData.find((alert) => alert.id === selectedAlert.id);
		return updatedAlert || selectedAlert;
	}, [selectedAlert, currentAlertData]);

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

	const handleSaveDashboard = async () => {
		const dashboardData = {
			name: dashboardState.name || 'New Dashboard',
			type: dashboardState.type,
			description: dashboardState.description,
			filters: dashboardState.filters,
			visibleColumns: dashboardState.visibleColumns.filter((col) => col !== ACTIONS_COLUMN),
			query: dashboardState.query,
			groupBy: dashboardState.groupBy,
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

	useResolvedTabStatusFilterReset({
		activeTab,
		filters: dashboardState.filters,
		onFilterChange: handleFilterChange,
	});

	const filteredAlerts = useAlertsFiltering(alerts, {
		filters: dashboardState.filters,
		timeRange: dashboardState.timeRange,
	});
	const filteredResolvedAlerts = useAlertsFiltering(resolvedAlerts, {
		filters: dashboardState.filters,
		timeRange: dashboardState.timeRange,
	});

	// Split the active, filtered alerts by assignment for the side-by-side view.
	const unassignedAlerts = useMemo(() => filteredAlerts.filter((a) => !a.ownerId), [filteredAlerts]);
	const assignedAlerts = useMemo(() => filteredAlerts.filter((a) => !!a.ownerId), [filteredAlerts]);

	// Combined "All" view: active alerts followed by resolved ones tagged so each row can route
	// its own actions. resolvedIds lets shared callbacks tell which list an alert belongs to.
	const resolvedIds = useMemo(() => new Set(resolvedAlerts.map((a) => a.id)), [resolvedAlerts]);
	const filteredAllAlerts = useMemo(
		() => [...filteredAlerts, ...filteredResolvedAlerts.map((a) => ({ ...a, isResolved: true }))],
		[filteredAlerts, filteredResolvedAlerts]
	);

	const {
		handleDismissAlert,
		handleUndismissAlert,
		handleDeleteAlert,
		handleDismissAll,
		handleAssignOwnerAll,
		handleResolveAll,
		handleDeleteForeverAll,
	} = useAlertActions();
	const deleteResolvedAlertMutation = useDeleteResolvedAlert();
	const markAlertReadMutation = useMarkAlertRead();

	const handleDismissAllSelected = async () => {
		await handleDismissAll(selectedAlerts, () => setSelectedAlerts([]));
	};

	const handleAssignOwnerAllSelected = async (ownerId: string | null) => {
		await handleAssignOwnerAll(selectedAlerts, ownerId, () => setSelectedAlerts([]));
	};

	const handleResolveAllSelected = async () => {
		setSelectedAlert(null);
		await handleResolveAll(selectedAlerts, () => setSelectedAlerts([]));
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

	// In the combined "All" view, route delete to the right mutation based on the alert's list.
	const handleDeleteAnyAlert = (alertId: string) => {
		if (resolvedIds.has(alertId)) {
			void handleDeleteResolvedAlert(alertId);
		} else {
			void handleDeleteAlert(alertId);
		}
	};

	// Active-tab alerts table, parameterized by the alert list so it can render full-width
	// or inside one of the split-by-assignment panes without duplicating the prop wiring.
	const renderActiveAlertsTable = (list: Alert[]) => (
		<AlertsTable
			alerts={list}
			services={services}
			onDismissAlert={handleDismissAlert}
			onUndismissAlert={handleUndismissAlert}
			onDeleteAlert={handleDeleteAlert}
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
			tagKeys={tagKeys}
			timeRange={dashboardState.timeRange}
			onTimeRangeChange={(range) => updateDashboardField('timeRange', range)}
			searchTerm={dashboardState.query}
			onSearchTermChange={(term) => updateDashboardField('query', term)}
			renderToolbar={false}
			severityColors={severityColors}
		/>
	);

	const handleLaunchTVMode = () => {
		setSelectedAlert(null); // Close alert details panel before navigating
		navigate('/alerts/tv-mode');
	};

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
				columnOrder: [],
				groupBy: dashboard.groupBy || [],
				query: dashboard.query || '',
				timeRange: { from: null, to: null, preset: null },
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
						isResolved={activeTab === AlertTab.Resolved}
					/>
				</FilterSidebar>

				<div className="flex-1 flex min-h-0 overflow-hidden">
					<div className={cn('flex flex-col p-4 min-h-0 transition-all duration-300', 'flex-1 min-w-0')}>
						<div className="flex-shrink-0 mb-4">
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
								onLaunchTVMode={handleLaunchTVMode}
								dashboards={dashboards}
								onDashboardSelect={handleDashboardSelect}
								onNewDashboard={handleNewDashboard}
								isDraft={!dashboardState.id}
							/>

							<div className="mt-3 flex items-center gap-4">
								<ToggleGroup
									type="single"
									value={activeTab}
									onValueChange={(value) => {
										if (value) {
											const newTab = value as AlertTab;
											setActiveTab(newTab);
											setSelectedAlert(null);
											setSelectedAlerts([]);
										}
									}}
									className="justify-start"
								>
									<ToggleGroupItem
										value={AlertTab.Active}
										aria-label="Active alerts"
										size="sm"
										className="gap-1.5 bg-transparent text-foreground hover:bg-muted hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg]:text-current data-[state=on]:[&_svg]:text-primary-foreground"
									>
										<Bell className="h-4 w-4" />
										<span>Active</span>
									</ToggleGroupItem>
									<ToggleGroupItem
										value={AlertTab.Resolved}
										aria-label="Resolved alerts"
										size="sm"
										className="gap-1.5 bg-transparent text-foreground hover:bg-muted hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg]:text-current data-[state=on]:[&_svg]:text-primary-foreground"
									>
										<CheckCircle2 className="h-4 w-4" />
										<span>Resolved</span>
									</ToggleGroupItem>
									<ToggleGroupItem
										value={AlertTab.All}
										aria-label="All alerts"
										size="sm"
										className="gap-1.5 bg-transparent text-foreground hover:bg-muted hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg]:text-current data-[state=on]:[&_svg]:text-primary-foreground"
									>
										<LayoutList className="h-4 w-4" />
										<span>All</span>
									</ToggleGroupItem>
								</ToggleGroup>
								<span className="text-sm text-muted-foreground whitespace-nowrap">
									{(() => {
										const count =
											activeTab === AlertTab.Active
												? filteredAlerts.length
												: activeTab === AlertTab.Resolved
													? filteredResolvedAlerts.length
													: filteredAllAlerts.length;
										return `${count} Alert${count !== 1 ? 's' : ''}`;
									})()}
								</span>

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
										className="gap-1.5 flex-shrink-0"
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
									className="gap-1.5 flex-shrink-0"
									title="Color rows by severity"
								>
									<Palette className="h-4 w-4" />
									<span className="hidden lg:inline">Severity colors</span>
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

								<div className="flex-shrink-0">
									<AlertsSelectionBar
										selectedAlerts={selectedAlerts}
										onClearSelection={() => setSelectedAlerts([])}
										onDismissAll={handleDismissAllSelected}
										onAssignOwnerAll={handleAssignOwnerAllSelected}
										onResolveAll={handleResolveAllSelected}
										onDeleteAll={handleDeleteAllSelected}
									/>
								</div>
							</>
						) : activeTab === AlertTab.Resolved ? (
							<div
								className={cn(
									'flex-1 min-h-0',
									resolvedAlerts.length === 0 &&
										!isLoadingResolved &&
										'flex items-center justify-center'
								)}
							>
								<AlertsTable
									alerts={filteredResolvedAlerts}
									services={services}
									onDismissAlert={undefined}
									onUndismissAlert={undefined}
									onDeleteAlert={handleDeleteResolvedAlert}
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
									tagKeys={tagKeys}
									timeRange={dashboardState.timeRange}
									onTimeRangeChange={(range) => updateDashboardField('timeRange', range)}
									searchTerm={dashboardState.query}
									onSearchTermChange={(term) => updateDashboardField('query', term)}
									renderToolbar={false}
									severityColors={severityColors}
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
									onDismissAlert={handleDismissAlert}
									onUndismissAlert={handleUndismissAlert}
									onDeleteAlert={handleDeleteAnyAlert}
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
									tagKeys={tagKeys}
									timeRange={dashboardState.timeRange}
									onTimeRangeChange={(range) => updateDashboardField('timeRange', range)}
									searchTerm={dashboardState.query}
									onSearchTermChange={(term) => updateDashboardField('query', term)}
									renderToolbar={false}
									severityColors={severityColors}
								/>
							</div>
						)}
					</div>

					{syncedSelectedAlert &&
						(() => {
							const selectedIsResolved =
								activeTab === AlertTab.Resolved ||
								(activeTab === AlertTab.All && resolvedIds.has(syncedSelectedAlert.id));
							return (
								<AlertDetailsPanel
									alert={syncedSelectedAlert}
									isActive={!selectedIsResolved}
									timeRange={dashboardState.timeRange}
									onClose={() => setSelectedAlert(null)}
									onDismiss={handleDismissAlert}
									onUndismiss={handleUndismissAlert}
									onDelete={selectedIsResolved ? handleDeleteResolvedAlert : handleDeleteAlert}
								/>
							);
						})()}
				</div>
			</div>

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
