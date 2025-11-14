import { DashboardLayout } from '@/components/DashboardLayout';
import { AlertsTable } from '@/components/AlertsTable';
import { AlertsFilterPanel } from '@/components/AlertsFilterPanel';
import { AlertDetails } from '@/components/AlertDetails';
import { Button } from '@/components/ui/button';
import { useAlerts, useDismissAlert, useUndismissAlert } from '@/hooks/queries/alerts';
import { useServices } from '@/hooks/queries/services';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { RefreshCw, Tv } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Alerts = () => {
	const navigate = useNavigate();
	const { data: alerts = [], isLoading, refetch } = useAlerts();
	const { data: services = [] } = useServices();
	const dismissAlertMutation = useDismissAlert();
	const undismissAlertMutation = useUndismissAlert();
	const { toast } = useToast();

	// State
	const [filters, setFilters] = useState<Record<string, string[]>>({});
	const [selectedAlerts, setSelectedAlerts] = useState<Alert[]>([]);
	const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
	const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false);
	const [visibleColumns, setVisibleColumns] = useState([
		'type',
		'alertName',
		'status',
		'tag',
		'summary',
		'startsAt',
		'actions',
	]);
	const [columnOrder, setColumnOrder] = useState([
		'type',
		'alertName',
		'status',
		'tag',
		'summary',
		'startsAt',
		'actions',
	]);
	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Auto-refresh every 30 seconds
	useEffect(() => {
		const interval = setInterval(() => {
			// Only auto-refresh if no dialogs are open
			const hasOpenDialog = document.querySelector('[role="dialog"]') || 
				document.querySelector('[data-state="open"]');
			
			if (!hasOpenDialog) {
				refetch();
				setLastRefresh(new Date());
			}
		}, 30000);

		return () => clearInterval(interval);
	}, [refetch]);

	// Manual refresh
	const handleManualRefresh = async () => {
		setIsRefreshing(true);
		try {
			await refetch();
			setLastRefresh(new Date());
			toast({
				title: 'Alerts refreshed',
				description: 'The alerts list has been updated.',
			});
		} catch (error) {
			toast({
				title: 'Error refreshing alerts',
				description: 'Failed to refresh alerts',
				variant: 'destructive',
			});
		} finally {
			setIsRefreshing(false);
		}
	};

	// Get alert type
	const getAlertType = (alert: Alert): string => {
		// Extract type from alert ID or tag
		if (alert.id.toLowerCase().includes('grafana')) return 'Grafana';
		if (alert.tag?.toLowerCase().includes('prometheus')) return 'Prometheus';
		if (alert.tag?.toLowerCase().includes('datadog')) return 'Datadog';
		return 'Custom';
	};

	// Filter alerts based on filters
	const filteredAlerts = useMemo(() => {
		if (Object.keys(filters).length === 0) return alerts;

		return alerts.filter((alert) => {
			// Check each filter
			for (const [field, values] of Object.entries(filters)) {
				if (values.length === 0) continue;

				let fieldValue: string;
				switch (field) {
					case 'status':
						fieldValue = alert.isDismissed ? 'Dismissed' : 'Firing';
						break;
					case 'type':
						fieldValue = getAlertType(alert);
						break;
					case 'tag':
						fieldValue = alert.tag;
						break;
					case 'alertName':
						fieldValue = alert.alertName;
						break;
					default:
						continue;
				}

				if (!values.includes(fieldValue)) {
					return false;
				}
			}
			return true;
		});
	}, [alerts, filters]);

	// Handle dismiss alert
	const handleDismissAlert = async (alertId: string) => {
		try {
			await dismissAlertMutation.mutateAsync(alertId);
			toast({
				title: 'Alert dismissed',
				description: 'The alert has been marked as dismissed.',
			});
		} catch (error) {
			toast({
				title: 'Error dismissing alert',
				description: 'Failed to dismiss alert',
				variant: 'destructive',
			});
		}
	};

	// Handle undismiss alert
	const handleUndismissAlert = async (alertId: string) => {
		try {
			await undismissAlertMutation.mutateAsync(alertId);
			toast({
				title: 'Alert undismissed',
				description: 'The alert has been reactivated.',
			});
		} catch (error) {
			toast({
				title: 'Error undismissing alert',
				description: 'Failed to undismiss alert',
				variant: 'destructive',
			});
		}
	};

	// Launch TV Mode
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
				{/* Filter Panel */}
				<AlertsFilterPanel
					alerts={alerts}
					services={services}
					filters={filters}
					onFilterChange={setFilters}
					collapsed={filterPanelCollapsed}
					onToggle={() => setFilterPanelCollapsed(!filterPanelCollapsed)}
				/>

				{/* Main Content */}
				<div className="flex-1 flex">
					<div className="flex-1 flex flex-col p-4">
						{/* Header */}
						<div className="mb-4">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
								<p className="text-sm text-muted-foreground mt-1">
									Monitor and manage system alerts
								</p>
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={handleManualRefresh}
									disabled={isRefreshing}
									className="gap-2"
								>
									<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
									Refresh
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={handleLaunchTVMode}
									className="gap-2"
								>
									<Tv className="h-4 w-4" />
									TV Mode
								</Button>
							</div>
						</div>
						{lastRefresh && (
							<p className="text-xs text-muted-foreground mt-2">
								Last refreshed: {lastRefresh.toLocaleTimeString()}
							</p>
						)}
					</div>

						{/* Alerts Table */}
						<div className="flex-1 overflow-auto">
							<AlertsTable
								alerts={filteredAlerts}
								services={services}
								onDismissAlert={handleDismissAlert}
								onUndismissAlert={handleUndismissAlert}
								onSelectAlerts={setSelectedAlerts}
								selectedAlerts={selectedAlerts}
								isLoading={isLoading}
								visibleColumns={visibleColumns}
								columnOrder={columnOrder}
								onAlertClick={setSelectedAlert}
							/>
						</div>

						{/* Selected alerts action bar (if needed) */}
						{selectedAlerts.length > 0 && (
							<div className="mt-4 p-3 bg-muted rounded-lg flex items-center justify-between">
								<span className="text-sm font-medium">
									{selectedAlerts.length} alert{selectedAlerts.length !== 1 ? 's' : ''} selected
								</span>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setSelectedAlerts([])}
									>
										Clear selection
									</Button>
									{selectedAlerts.every((a) => !a.isDismissed) && (
										<Button
											variant="outline"
											size="sm"
											onClick={async () => {
												for (const alert of selectedAlerts) {
													await handleDismissAlert(alert.id);
												}
												setSelectedAlerts([]);
											}}
										>
											Dismiss all
										</Button>
									)}
								</div>
							</div>
						)}
					</div>

					{/* Alert Details Sidebar */}
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
		</DashboardLayout>
	);
};

export default Alerts;
