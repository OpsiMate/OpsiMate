import { AlertDetails } from '@/components/Alerts/AlertDetails';
import { ACTIONS_COLUMN, COLUMN_LABELS } from '@/components/Alerts/AlertsTable/AlertsTable.constants';
import { getAlertValue } from '@/components/Alerts/AlertsTable/AlertsTable.utils';
import { DashboardHeader } from '@/components/Alerts/DashboardHeader';
import { DashboardSettingsDrawer } from '@/components/Alerts/DashboardSettingsDrawer';
import { useAlertTagKeys, useColumnManagement } from '@/components/Alerts/hooks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useDashboard } from '@/context/DashboardContext';
import { useAlerts, useDismissAlert, useUndismissAlert } from '@/hooks/queries/alerts';
import {
	useCreateDashboard,
	useDeleteDashboard,
	useGetDashboards,
	useUpdateDashboard,
} from '@/hooks/queries/dashboards';
import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { useServices } from '@/hooks/queries/services';
import { useUsers } from '@/hooks/queries/users';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { AlertTriangle, ArrowLeft, CheckCircle, Layers, LayoutGrid, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCard } from './AlertCard';
import { AlertsGroupedView } from './AlertsGroupedView';
import { AUTO_REFRESH_INTERVAL_MS, GRID_CLASSES, GROUPABLE_COLUMNS } from './AlertsTVMode.constants';
import { ViewMode } from './AlertsTVMode.types';
import { createServiceNameLookup, filterAlertsByFilters, getAlertServiceId, getCardSize } from './AlertsTVMode.utils';

const AlertsTVMode = () => {
	const navigate = useNavigate();
	const { toast } = useToast();

	const {
		dashboardState,
		updateDashboardField,
		isDirty,
		initialState,
		markAsClean,
		resetDashboard,
		setShowUnsavedChangesDialog,
		setPendingNavigation,
		setInitialState,
	} = useDashboard();

	const { data: alerts = [], isLoading, refetch } = useAlerts();
	const { data: services = [] } = useServices();
	const { data: users = [] } = useUsers();
	const { data: dashboards = [] } = useGetDashboards();
	const createDashboardMutation = useCreateDashboard();
	const updateDashboardMutation = useUpdateDashboard();
	const deleteDashboardMutation = useDeleteDashboard();
	const dismissAlertMutation = useDismissAlert();
	const undismissAlertMutation = useUndismissAlert();

	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>('grid');
	const [showDashboardSettings, setShowDashboardSettings] = useState(false);
	const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

	const allAlerts = useMemo(() => alerts, [alerts]);
	const tagKeys = useAlertTagKeys(allAlerts);

	// Combine base groupable columns with tag keys
	const allGroupableColumns = useMemo(() => {
		const tagKeyColumns = tagKeys.map((tk) => `tagKey:${tk.key}`);
		return [...GROUPABLE_COLUMNS, ...tagKeyColumns];
	}, [tagKeys]);

	const { visibleColumns, handleColumnToggle } = useColumnManagement({
		tagKeys,
		initialVisibleColumns: dashboardState.visibleColumns.length > 0 ? dashboardState.visibleColumns : undefined,
		initialColumnOrder: dashboardState.columnOrder.length > 0 ? dashboardState.columnOrder : undefined,
	});

	useEffect(() => {
		if (JSON.stringify(visibleColumns) !== JSON.stringify(dashboardState.visibleColumns)) {
			updateDashboardField('visibleColumns', visibleColumns);
		}
	}, [visibleColumns, dashboardState.visibleColumns, updateDashboardField]);

	const serviceNameById = useMemo(() => createServiceNameLookup(services), [services]);

	const getServiceName = useCallback(
		(alert: Alert): string => {
			const serviceId = getAlertServiceId(alert);
			if (!serviceId) return '-';
			return serviceNameById[serviceId] || `#${serviceId}`;
		},
		[serviceNameById]
	);

	const getAlertValueWithService = useCallback(
		(alert: Alert, field: string) => {
			if (field === 'serviceName') {
				return getServiceName(alert);
			}
			return getAlertValue(alert, field);
		},
		[getServiceName]
	);

	const filteredAlerts = useMemo(
		() => filterAlertsByFilters(alerts, dashboardState.filters, getServiceName, users),
		[alerts, dashboardState.filters, getServiceName, users]
	);

	useEffect(() => {
		const interval = setInterval(() => {
			refetch();
			setLastRefresh(new Date());
		}, AUTO_REFRESH_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [refetch]);

	const handleManualRefresh = useCallback(async () => {
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
	}, [refetch, toast]);

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

	const handleNavigateBack = useCallback(() => {
		// TV Mode doesn't save changes - just navigate back
		navigate('/alerts');
	}, [navigate]);

	const handleNewDashboard = useCallback(() => {
		if (isDirty) {
			setPendingNavigation(() => resetDashboard);
			setShowUnsavedChangesDialog(true);
		} else {
			resetDashboard();
		}
	}, [isDirty, resetDashboard, setPendingNavigation, setShowUnsavedChangesDialog]);

	const handleDashboardSelect = useCallback(
		(dashboard: Dashboard) => {
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
		},
		[isDirty, setInitialState, setPendingNavigation, setShowUnsavedChangesDialog]
	);

	const handleDeleteDashboard = useCallback(async () => {
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
	}, [dashboardState.id, deleteDashboardMutation, resetDashboard, toast]);

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

	useEffect(() => {
		const handleKeyPress = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				const dialogOpen = document.querySelector('[role="dialog"]');
				if (!dialogOpen) {
					handleNavigateBack();
				}
			} else if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
				handleManualRefresh();
			}
		};

		window.addEventListener('keydown', handleKeyPress);
		return () => window.removeEventListener('keydown', handleKeyPress);
	}, [handleNavigateBack, handleManualRefresh]);

	const cardSize = getCardSize(filteredAlerts.length);

	const activeAlertsCount = filteredAlerts.filter((a) => !a.isDismissed).length;
	const criticalCount = filteredAlerts.filter(
		(a) => !a.isDismissed && (a.tags?.severity || a.tags?.priority || '').toLowerCase() === 'critical'
	).length;

	return (
		<div className="h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col overflow-hidden">
			{/* Modern Header */}
			<div className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b">
				<div className="px-6 py-4">
					<div className="flex items-center justify-between">
						{/* Left side - Back button and title */}
						<div className="flex items-center gap-4">
							<Button
								variant="ghost"
								size="sm"
								onClick={handleNavigateBack}
								className="gap-2 hover:bg-muted"
							>
								<ArrowLeft className="h-4 w-4" />
								Back
							</Button>

							<div className="h-6 w-px bg-border" />

							<div>
								<DashboardHeader
									dashboardName={dashboardState.name}
									onDashboardNameChange={(name) => updateDashboardField('name', name)}
									onDashboardNameBlur={() => {}}
									isDirty={false}
									onSave={undefined}
									isRefreshing={isRefreshing}
									lastRefresh={lastRefresh}
									onRefresh={handleManualRefresh}
									showTvModeButton={false}
									dashboards={dashboards}
									onDashboardSelect={handleDashboardSelect}
								/>
							</div>
						</div>

						{/* Right side - Stats and controls */}
						<div className="flex items-center gap-4">
							{/* Stats */}
							<div className="flex items-center gap-3">
								{criticalCount > 0 && (
									<div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30">
										<AlertTriangle className="h-4 w-4 text-red-500" />
										<span className="text-sm font-semibold text-red-500">
											{criticalCount} Critical
										</span>
									</div>
								)}
								<div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
									<span className="text-sm font-medium text-foreground">
										{activeAlertsCount} Active
									</span>
									<span className="text-sm text-muted-foreground">/</span>
									<span className="text-sm text-muted-foreground">{filteredAlerts.length} Total</span>
								</div>
							</div>

							{/* View toggle */}
							<div className="flex items-center bg-muted/50 rounded-lg p-1 border">
								<Button
									variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
									size="sm"
									onClick={() => setViewMode('grid')}
									className="h-8 px-3 gap-2"
								>
									<LayoutGrid className="h-4 w-4" />
									Grid
								</Button>
								<Button
									variant={viewMode === 'heatmap' ? 'secondary' : 'ghost'}
									size="sm"
									onClick={() => setViewMode('heatmap')}
									className="h-8 px-3 gap-2"
								>
									<Layers className="h-4 w-4" />
									Grouped
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div
				className={cn('flex-1', viewMode === 'heatmap' ? 'p-0 overflow-hidden relative' : 'p-6 overflow-auto')}
			>
				{isLoading ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-center">
							<div className="relative">
								<RefreshCw className="h-12 w-12 animate-spin mx-auto text-primary" />
								<div className="absolute inset-0 h-12 w-12 mx-auto rounded-full bg-primary/20 animate-ping" />
							</div>
							<p className="mt-4 text-lg text-muted-foreground">Loading alerts...</p>
						</div>
					</div>
				) : filteredAlerts.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-center">
							<div className="relative mb-6">
								<div className="h-20 w-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
									<CheckCircle className="h-10 w-10 text-green-500" />
								</div>
								<div className="absolute inset-0 h-20 w-20 mx-auto rounded-full bg-green-500/20 animate-pulse" />
							</div>
							<h2 className="text-2xl font-semibold text-foreground">All Clear</h2>
							<p className="mt-2 text-muted-foreground">No active alerts • All systems operational</p>
						</div>
					</div>
				) : viewMode === 'heatmap' ? (
					<div className="absolute inset-0">
						<AlertsGroupedView
							alerts={filteredAlerts}
							groupBy={dashboardState.groupBy}
							customValueGetter={getAlertValueWithService}
							onAlertClick={(alert) => setSelectedAlert(alert)}
							groupByColumns={dashboardState.groupBy}
							onGroupByChange={(cols) => updateDashboardField('groupBy', cols)}
							availableColumns={allGroupableColumns}
						/>
					</div>
				) : (
					<div className={cn('grid', GRID_CLASSES[cardSize])}>
						{filteredAlerts.map((alert) => (
							<AlertCard
								key={alert.id}
								alert={alert}
								cardSize={cardSize}
								serviceName={getServiceName(alert)}
								onClick={() => setSelectedAlert(alert)}
							/>
						))}
					</div>
				)}
			</div>

			{/* Keyboard shortcuts hint */}
			<div className="fixed bottom-4 right-4 text-xs bg-background/90 backdrop-blur-xl rounded-xl px-4 py-2 border shadow-lg">
				<div className="flex items-center gap-4">
					<span className="flex items-center gap-2">
						<kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded-md border text-foreground">
							ESC
						</kbd>
						<span className="text-muted-foreground">Exit</span>
					</span>
					<span className="flex items-center gap-2">
						<kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded-md border text-foreground">
							R
						</kbd>
						<span className="text-muted-foreground">Refresh</span>
					</span>
				</div>
			</div>

			{/* Alert Details Modal */}
			<Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
				<DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden" showClose={false}>
					<AlertDetails
						isActive={true}
						alert={selectedAlert}
						onClose={() => setSelectedAlert(null)}
						onDismiss={handleDismissAlert}
						onUndismiss={handleUndismissAlert}
					/>
				</DialogContent>
			</Dialog>

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
				excludeColumns={[ACTIONS_COLUMN]}
				tagKeys={tagKeys}
				onDelete={handleDeleteDashboard}
				canDelete={!!dashboardState.id}
			/>
		</div>
	);
};

export default AlertsTVMode;
