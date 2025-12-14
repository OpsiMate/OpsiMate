import { DashboardLayout } from '@/components/DashboardLayout';
import { FilterSidebar } from '@/components/shared';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDashboard } from '@/context/DashboardContext';
import { useAlerts, useArchivedAlerts, useDeleteArchivedAlert } from '@/hooks/queries/alerts';
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
import { Archive, Bell } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertsFilterPanel } from '.';
import { AlertDetails } from './AlertDetails';
import { AlertsSelectionBar } from './AlertsSelectionBar';
import { AlertsTable } from './AlertsTable';
import { COLUMN_LABELS } from './AlertsTable/AlertsTable.constants';
import { DashboardHeader } from './DashboardHeader';
import { DashboardSettingsDrawer } from './DashboardSettingsDrawer';
import { useAlertActions, useAlertsFiltering, useAlertsRefresh, useAlertTagKeys, useColumnManagement } from './hooks';

const Alerts = () => {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { data: alerts = [], isLoading, refetch } = useAlerts();
	const { data: archivedAlerts = [], isLoading: isLoadingArchived, refetch: refetchArchived } = useArchivedAlerts();
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

	const {
		lastRefresh: lastRefreshActive,
		isRefreshing: isRefreshingActive,
		handleManualRefresh: handleManualRefreshActive,
	} = useAlertsRefresh(refetch, {
		shouldPause: shouldPauseRefresh || activeTab !== 'active',
	});

	const {
		lastRefresh: lastRefreshArchived,
		isRefreshing: isRefreshingArchived,
		handleManualRefresh: handleManualRefreshArchived,
	} = useAlertsRefresh(refetchArchived, {
		shouldPause: shouldPauseRefresh || activeTab !== 'archived',
	});

	const lastRefresh = activeTab === 'active' ? lastRefreshActive : lastRefreshArchived;
	const isRefreshing = activeTab === 'active' ? isRefreshingActive : isRefreshingArchived;
	const handleManualRefresh = activeTab === 'active' ? handleManualRefreshActive : handleManualRefreshArchived;

	const { visibleColumns, columnOrder, handleColumnToggle, allColumnLabels, enabledTagKeys } = useColumnManagement({
		tagKeys,
		initialVisibleColumns: dashboardState.visibleColumns.length > 0 ? dashboardState.visibleColumns : undefined,
		initialColumnOrder: dashboardState.columnOrder.length > 0 ? dashboardState.columnOrder : undefined,
	});

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
		const dashboardData = {
			name: dashboardState.name || 'New Dashboard',
			type: dashboardState.type,
			description: dashboardState.description,
			filters: dashboardState.filters,
			visibleColumns: dashboardState.visibleColumns,
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

	const filteredAlerts = useAlertsFiltering(alerts, dashboardState.filters);
	const filteredArchivedAlerts = useAlertsFiltering(archivedAlerts, dashboardState.filters);
	const { handleDismissAlert, handleUndismissAlert, handleDeleteAlert, handleDismissAll } = useAlertActions();
	const deleteArchivedAlertMutation = useDeleteArchivedAlert();

	const handleDismissAllSelected = async () => {
		await handleDismissAll(selectedAlerts, () => setSelectedAlerts([]));
	};

	const handleDeleteArchivedAlert = async (alertId: string) => {
		await deleteArchivedAlertMutation.mutateAsync(alertId);
	};

	const handleLaunchTVMode = () => {
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
						enabledTagKeys={enabledTagKeys}
					/>
				</FilterSidebar>

				<div className="flex-1 flex min-h-0">
					<div className="flex-1 flex flex-col p-4 min-h-0 min-w-0">
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
										groupByColumns={dashboardState.groupBy}
										onGroupByChange={(cols) => updateDashboardField('groupBy', cols)}
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
									groupByColumns={dashboardState.groupBy}
									onGroupByChange={(cols) => updateDashboardField('groupBy', cols)}
								/>
							</div>
						)}
					</div>

					{syncedSelectedAlert && (
						<div className="w-96 border-l flex-shrink-0">
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
				onDelete={handleDeleteDashboard}
				canDelete={!!dashboardState.id}
			/>
		</DashboardLayout>
	);
};

export default Alerts;
