import { DashboardLayout } from '@/components/DashboardLayout';
import { FilterSidebar } from '@/components/shared';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAlerts, useArchivedAlerts, useDeleteArchivedAlert } from '@/hooks/queries/alerts';
import { useServices } from '@/hooks/queries/services';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { Archive, Bell } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertsFilterPanel } from '.';
import { AlertDetails } from './AlertDetails';
import { DashboardHeader } from './DashboardHeader';
import { DashboardSettingsDrawer } from './DashboardSettingsDrawer';
import { AlertsSelectionBar } from './AlertsSelectionBar';
import { AlertsTable } from './AlertsTable';
import { COLUMN_LABELS } from './AlertsTable/AlertsTable.constants';
import { useAlertActions, useAlertsFiltering, useAlertsRefresh, useAlertTagKeys, useColumnManagement } from './hooks';
import { useDashboard } from '@/context/DashboardContext';
import { useGetDashboards } from '@/hooks/queries/dashboards/useGetDashboards';

const Alerts = () => {
	const navigate = useNavigate();
	const { data: alerts = [], isLoading, refetch } = useAlerts();
	const { data: archivedAlerts = [], isLoading: isLoadingArchived, refetch: refetchArchived } = useArchivedAlerts();
	const { data: services = [] } = useServices();
    const { data: dashboards = [] } = useGetDashboards();

    const {
        dashboardState,
        setDashboardState,
        isDirty,
        initialState,
        setInitialState,
        updateDashboardField
    } = useDashboard();

	const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
	const [selectedAlerts, setSelectedAlerts] = useState<Alert[]>([]);
	const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
	const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false);
	const [showDashboardSettings, setShowDashboardSettings] = useState(false);

	const allAlerts = useMemo(() => [...alerts, ...archivedAlerts], [alerts, archivedAlerts]);
	const tagKeys = useAlertTagKeys(allAlerts);

	const currentAlertData = activeTab === 'active' ? alerts : archivedAlerts;
	const syncedSelectedAlert = useMemo(() => {
		if (!selectedAlert) return null;
		const updatedAlert = currentAlertData.find((alert) => alert.id === selectedAlert.id);
		return updatedAlert || selectedAlert;
	}, [selectedAlert, currentAlertData]);

	const shouldPauseRefresh = showDashboardSettings || syncedSelectedAlert !== null;

	// Active alerts refresh
	const {
		lastRefresh: lastRefreshActive,
		isRefreshing: isRefreshingActive,
		handleManualRefresh: handleManualRefreshActive,
	} = useAlertsRefresh(refetch, {
		shouldPause: shouldPauseRefresh || activeTab !== 'active',
	});

	// Archived alerts refresh
	const {
		lastRefresh: lastRefreshArchived,
		isRefreshing: isRefreshingArchived,
		handleManualRefresh: handleManualRefreshArchived,
	} = useAlertsRefresh(refetchArchived, {
		shouldPause: shouldPauseRefresh || activeTab !== 'archived',
	});

	// Use the appropriate refresh state based on active tab
	const lastRefresh = activeTab === 'active' ? lastRefreshActive : lastRefreshArchived;
	const isRefreshing = activeTab === 'active' ? isRefreshingActive : isRefreshingArchived;
	const handleManualRefresh = activeTab === 'active' ? handleManualRefreshActive : handleManualRefreshArchived;

    // We map context state to local variables for compatibility with existing hooks
    // but hooks should probably be updated to use context directly in a real refactor.
    // For now, we sync context state with what useColumnManagement expects.

	const { visibleColumns, columnOrder, handleColumnToggle, allColumnLabels, enabledTagKeys } = useColumnManagement({
		tagKeys,
        initialVisibleColumns: dashboardState.visibleColumns.length > 0 ? dashboardState.visibleColumns : undefined,
        initialColumnOrder: dashboardState.columnOrder.length > 0 ? dashboardState.columnOrder : undefined,
	});

    // Sync column changes back to context
    useEffect(() => {
        if (JSON.stringify(visibleColumns) !== JSON.stringify(dashboardState.visibleColumns)) {
            updateDashboardField('visibleColumns', visibleColumns);
        }
    }, [visibleColumns, dashboardState.visibleColumns, updateDashboardField]);

    useEffect(() => {
         if (JSON.stringify(columnOrder) !== JSON.stringify(dashboardState.columnOrder)) {
            updateDashboardField('columnOrder', columnOrder);
        }
    }, [columnOrder, dashboardState.columnOrder, updateDashboardField]);


	const handleSaveDashboard = async () => {
		// Mock API call
		console.log('Saving dashboard:', dashboardState);

		if (dashboardState.id) {
			// PUT
			console.log('PUT request');
		} else {
			// POST
			console.log('POST request');
			// Simulate creating a new ID
			updateDashboardField('id', 'new-dashboard-id');
		}

		// Update initial state to match current state
        setInitialState(dashboardState);
	};

    // Sync filters
    const handleFilterChange = (newFilters: Record<string, string[]>) => {
        if (activeTab === 'active') {
            updateDashboardField('activeFilters', newFilters);
        } else {
            updateDashboardField('archivedFilters', newFilters);
        }
    };

    const currentFilters = activeTab === 'active' ? dashboardState.activeFilters : dashboardState.archivedFilters;

	const filteredAlerts = useAlertsFiltering(alerts, dashboardState.activeFilters);
	const filteredArchivedAlerts = useAlertsFiltering(archivedAlerts, dashboardState.archivedFilters);
	const { handleDismissAlert, handleUndismissAlert, handleDeleteAlert, handleDismissAll } = useAlertActions();
	const deleteArchivedAlertMutation = useDeleteArchivedAlert();

	const handleDismissAllSelected = async () => {
		await handleDismissAll(selectedAlerts, () => setSelectedAlerts([]));
	};

	const handleDeleteArchivedAlert = async (alertId: string) => {
		await deleteArchivedAlertMutation.mutateAsync(alertId);
	};

	const handleLaunchTVMode = () => {
        // No need to pass params in URL anymore since we use context
		navigate(`/alerts/tv-mode`);
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
						filters={currentFilters}
						onFilterChange={handleFilterChange}
						collapsed={filterPanelCollapsed}
						enabledTagKeys={enabledTagKeys}
					/>
				</FilterSidebar>

				<div className="flex-1 flex min-h-0">
					<div className="flex-1 flex flex-col p-4 min-h-0">
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
								dashboards={dashboards.map(d => ({ id: d.id, name: d.name }))}
								onDashboardSelect={(id) => console.log('Selected dashboard:', id)}
							/>

							<div className="mt-3">
								<ToggleGroup
									type="single"
									value={activeTab}
									onValueChange={(value) => {
										if (value) setActiveTab(value as 'active' | 'archived');
									}}
									className="justify-start"
								>
									<ToggleGroupItem
										value="active"
										aria-label="Active alerts"
										size="sm"
										className="gap-1.5 text-foreground hover:bg-primary/10 hover:text-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
									>
										<Bell className="h-4 w-4" />
										<span>Active</span>
									</ToggleGroupItem>
									<ToggleGroupItem
										value="archived"
										aria-label="Archived alerts"
										size="sm"
										className="gap-1.5 text-foreground hover:bg-primary/10 hover:text-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
									>
										<Archive className="h-4 w-4" />
										<span>Archived</span>
									</ToggleGroupItem>
								</ToggleGroup>
							</div>
						</div>

						{activeTab === 'active' ? (
							<>
								<div
									className={cn(
										'flex-1 min-h-0',
										alerts.length === 0 && !isLoading && 'flex items-center justify-center'
									)}
								>
									<AlertsTable
										alerts={filteredAlerts}
										services={services}
										onDismissAlert={handleDismissAlert}
										onUndismissAlert={handleUndismissAlert}
										onDeleteAlert={handleDeleteAlert}
										onSelectAlerts={setSelectedAlerts}
										selectedAlerts={selectedAlerts}
										isLoading={isLoading}
										visibleColumns={visibleColumns}
										columnOrder={columnOrder}
										onAlertClick={setSelectedAlert}
										onTableSettingsClick={() => setShowDashboardSettings(true)}
										tagKeyColumnLabels={allColumnLabels}
									/>
								</div>

								<div className="flex-shrink-0">
									<AlertsSelectionBar
										selectedAlerts={selectedAlerts}
										onClearSelection={() => setSelectedAlerts([])}
										onDismissAll={handleDismissAllSelected}
									/>
								</div>
							</>
						) : (
							<div
								className={cn(
									'flex-1 min-h-0',
									archivedAlerts.length === 0 &&
										!isLoadingArchived &&
										'flex items-center justify-center'
								)}
							>
								<AlertsTable
									alerts={filteredArchivedAlerts}
									services={services}
									onDismissAlert={undefined}
									onUndismissAlert={undefined}
									onDeleteAlert={handleDeleteArchivedAlert}
									onSelectAlerts={undefined}
									selectedAlerts={[]}
									isLoading={isLoadingArchived}
									visibleColumns={visibleColumns}
									columnOrder={columnOrder}
									onAlertClick={setSelectedAlert}
									onTableSettingsClick={() => setShowDashboardSettings(true)}
									tagKeyColumnLabels={allColumnLabels}
								/>
							</div>
						)}
					</div>

					{syncedSelectedAlert && (
						<div className="w-96 border-l">
							<AlertDetails
								isActive={activeTab == 'active'}
								alert={syncedSelectedAlert}
								onClose={() => setSelectedAlert(null)}
								onDismiss={handleDismissAlert}
								onUndismiss={handleUndismissAlert}
								onDelete={activeTab === 'active' ? handleDeleteAlert : handleDeleteArchivedAlert}
							/>
						</div>
					)}
				</div>
			</div>

			<DashboardSettingsDrawer
				open={showDashboardSettings}
				onOpenChange={setShowDashboardSettings}
				dashboardName={dashboardState.name}
				onDashboardNameChange={(name) => updateDashboardField('name', name)}
				dashboardDescription={dashboardState.description}
				onDashboardDescriptionChange={(desc) => updateDashboardField('description', desc)}
				visibleColumns={visibleColumns}
				onColumnToggle={handleColumnToggle}
				columnLabels={COLUMN_LABELS}
				excludeColumns={['actions']}
				tagKeys={tagKeys}
			/>
		</DashboardLayout>
	);
};

export default Alerts;
