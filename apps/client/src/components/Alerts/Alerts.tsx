import { DashboardLayout } from '@/components/DashboardLayout';
import { ColumnSettingsModal, FilterSidebar } from '@/components/shared';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAlerts, useArchivedAlerts, useDeleteArchivedAlert } from '@/hooks/queries/alerts';
import { useServices } from '@/hooks/queries/services';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { Archive, Bell } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertsFilterPanel } from '.';
import { AlertDetails } from './AlertDetails';
import { AlertsHeader } from './AlertsHeader';
import { AlertsSelectionBar } from './AlertsSelectionBar';
import { AlertsTable } from './AlertsTable';
import { COLUMN_LABELS } from './AlertsTable/AlertsTable.constants';
import { useAlertActions, useAlertsFiltering, useAlertsRefresh, useAlertTagKeys, useColumnManagement } from './hooks';

const Alerts = () => {
	const navigate = useNavigate();
	const { data: alerts = [], isLoading, refetch } = useAlerts();
	const { data: archivedAlerts = [], isLoading: isLoadingArchived, refetch: refetchArchived } = useArchivedAlerts();
	const { data: services = [] } = useServices();

	const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
	const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
	const [archivedFilters, setArchivedFilters] = useState<Record<string, string[]>>({});
	const [selectedAlerts, setSelectedAlerts] = useState<Alert[]>([]);
	const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
	const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false);
	const [showColumnSettings, setShowColumnSettings] = useState(false);

	const allAlerts = useMemo(() => [...alerts, ...archivedAlerts], [alerts, archivedAlerts]);
	const tagKeys = useAlertTagKeys(allAlerts);

	const currentAlertData = activeTab === 'active' ? alerts : archivedAlerts;
	const syncedSelectedAlert = useMemo(() => {
		if (!selectedAlert) return null;
		const updatedAlert = currentAlertData.find((alert) => alert.id === selectedAlert.id);
		return updatedAlert || selectedAlert;
	}, [selectedAlert, currentAlertData]);

	const shouldPauseRefresh = showColumnSettings || syncedSelectedAlert !== null;

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
	const currentFilters = activeTab === 'active' ? activeFilters : archivedFilters;
	const currentAlerts = activeTab === 'active' ? alerts : archivedAlerts;
	const { visibleColumns, columnOrder, handleColumnToggle, allColumnLabels, enabledTagKeys } = useColumnManagement({
		tagKeys,
	});
	const filteredAlerts = useAlertsFiltering(alerts, activeFilters);
	const filteredArchivedAlerts = useAlertsFiltering(archivedAlerts, archivedFilters);
	const { handleDismissAlert, handleUndismissAlert, handleDeleteAlert, handleDismissAll } = useAlertActions();
	const deleteArchivedAlertMutation = useDeleteArchivedAlert();

	const handleDismissAllSelected = async () => {
		await handleDismissAll(selectedAlerts, () => setSelectedAlerts([]));
	};

	const handleDeleteArchivedAlert = async (alertId: string) => {
		await deleteArchivedAlertMutation.mutateAsync(alertId);
	};

	const handleLaunchTVMode = () => {
		const params = new URLSearchParams({
			filters: JSON.stringify(activeFilters),
			visibleColumns: JSON.stringify(visibleColumns),
			columnOrder: JSON.stringify(columnOrder),
		});
		navigate(`/alerts/tv-mode?${params.toString()}`);
	};

	return (
		<DashboardLayout>
			<div className="flex h-full">
				<FilterSidebar
					collapsed={filterPanelCollapsed}
					onToggle={() => setFilterPanelCollapsed(!filterPanelCollapsed)}
				>
					<AlertsFilterPanel
						alerts={currentAlerts}
						filters={currentFilters}
						onFilterChange={activeTab === 'active' ? setActiveFilters : setArchivedFilters}
						collapsed={filterPanelCollapsed}
						enabledTagKeys={enabledTagKeys}
					/>
				</FilterSidebar>

				<div className="flex-1 flex min-h-0">
					<div className="flex-1 flex flex-col p-4 min-h-0 min-w-0">
						<div className="flex-shrink-0 mb-4">
							<AlertsHeader
								alertsCount={activeTab === 'active' ? alerts.length : archivedAlerts.length}
								isRefreshing={isRefreshing}
								lastRefresh={lastRefresh}
								onRefresh={handleManualRefresh}
								onLaunchTVMode={handleLaunchTVMode}
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
										onTableSettingsClick={() => setShowColumnSettings(true)}
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
									onTableSettingsClick={() => setShowColumnSettings(true)}
									tagKeyColumnLabels={allColumnLabels}
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

			<ColumnSettingsModal
				open={showColumnSettings}
				onOpenChange={setShowColumnSettings}
				visibleColumns={visibleColumns}
				onColumnToggle={handleColumnToggle}
				columnLabels={COLUMN_LABELS}
				title="Alert Table Settings"
				description="Select which columns to display in the alerts table."
				excludeColumns={['actions']}
				tagKeys={tagKeys}
			/>
		</DashboardLayout>
	);
};

export default Alerts;
