import { DashboardLayout } from '@/components/DashboardLayout';
import { ColumnSettingsModal, FilterSidebar } from '@/components/shared';
import { useAlerts } from '@/hooks/queries/alerts';
import { useServices } from '@/hooks/queries/services';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertsFilterPanel } from '.';
import { AlertDetails } from './AlertDetails';
import { AlertsHeader } from './AlertsHeader';
import { AlertsSelectionBar } from './AlertsSelectionBar';
import { AlertsTable } from './AlertsTable';
import { COLUMN_LABELS } from './AlertsTable/AlertsTable.constants';
import { useAlertActions, useAlertsFiltering, useAlertsRefresh, useColumnManagement } from './hooks';

const Alerts = () => {
	const navigate = useNavigate();
	const { data: alerts = [], isLoading, refetch } = useAlerts();
	const { data: services = [] } = useServices();

	const [filters, setFilters] = useState<Record<string, string[]>>({});
	const [selectedAlerts, setSelectedAlerts] = useState<Alert[]>([]);
	const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
	const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false);
	const [showColumnSettings, setShowColumnSettings] = useState(false);

	const shouldPauseRefresh = showColumnSettings || selectedAlert !== null;

	const { lastRefresh, isRefreshing, handleManualRefresh } = useAlertsRefresh(refetch, {
		shouldPause: shouldPauseRefresh,
	});
	const filteredAlerts = useAlertsFiltering(alerts, filters);
	const { visibleColumns, columnOrder, handleColumnToggle } = useColumnManagement();
	const { handleDismissAlert, handleUndismissAlert, handleDeleteAlert, handleDismissAll } = useAlertActions();

	const handleDismissAllSelected = async () => {
		await handleDismissAll(selectedAlerts, () => setSelectedAlerts([]));
	};

	const handleLaunchTVMode = () => {
		const params = new URLSearchParams({
			filters: JSON.stringify(filters),
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
						alerts={alerts}
						filters={filters}
						onFilterChange={setFilters}
						collapsed={filterPanelCollapsed}
					/>
				</FilterSidebar>

				<div className="flex-1 flex min-h-0">
					<div className="flex-1 flex flex-col p-4 min-h-0">
						<div className="mb-4 flex-shrink-0">
							<AlertsHeader
								alertsCount={alerts.length}
								isRefreshing={isRefreshing}
								lastRefresh={lastRefresh}
								onRefresh={handleManualRefresh}
								onLaunchTVMode={handleLaunchTVMode}
							/>
						</div>

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
							/>
						</div>

						<div className="flex-shrink-0">
							<AlertsSelectionBar
								selectedAlerts={selectedAlerts}
								onClearSelection={() => setSelectedAlerts([])}
								onDismissAll={handleDismissAllSelected}
							/>
						</div>
					</div>

					{selectedAlert && (
						<div className="w-96 border-l">
							<AlertDetails
								alert={selectedAlert}
								onClose={() => setSelectedAlert(null)}
								onDismiss={handleDismissAlert}
								onUndismiss={handleUndismissAlert}
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
			/>
		</DashboardLayout>
	);
};

export default Alerts;
