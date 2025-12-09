import { getAlertValue } from '@/components/Alerts/AlertsTable/AlertsTable.utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAlerts, useDismissAlert, useUndismissAlert } from '@/hooks/queries/alerts';
import { useServices } from '@/hooks/queries/services';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { ArrowLeft, CheckCircle, LayoutGrid, Map as MapIcon, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCard } from './AlertCard';
import { AlertsHeatmap } from './AlertsHeatmap';
import { AUTO_REFRESH_INTERVAL_MS, GRID_CLASSES, GROUPABLE_COLUMNS } from './AlertsTVMode.constants';
import { ViewMode } from './AlertsTVMode.types';
import { createServiceNameLookup, filterAlertsByFilters, getAlertServiceId, getCardSize } from './AlertsTVMode.utils';
import { useDashboard } from '@/context/DashboardContext';
import { DashboardHeader } from '@/components/Alerts/DashboardHeader';
import { DashboardSettingsDrawer } from '@/components/Alerts/DashboardSettingsDrawer';
import { COLUMN_LABELS } from '@/components/Alerts/AlertsTable/AlertsTable.constants';
import { useAlertTagKeys, useColumnManagement } from '@/components/Alerts/hooks';
import { useGetDashboards, useCreateDashboard, useUpdateDashboard } from '@/hooks/queries/dashboards';

const AlertsTVMode = () => {
	const navigate = useNavigate();
	const { toast } = useToast();

    const {
        dashboardState,
        updateDashboardField,
        isDirty,
        initialState,
        markAsClean
    } = useDashboard();

	const { data: alerts = [], isLoading, refetch } = useAlerts();
	const { data: services = [] } = useServices();
    const { data: dashboards = [] } = useGetDashboards();
    const createDashboardMutation = useCreateDashboard();
    const updateDashboardMutation = useUpdateDashboard();
	const dismissAlertMutation = useDismissAlert();
	const undismissAlertMutation = useUndismissAlert();

	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
    const [showDashboardSettings, setShowDashboardSettings] = useState(false);

    const allAlerts = useMemo(() => alerts, [alerts]);
	const tagKeys = useAlertTagKeys(allAlerts);

    const { visibleColumns, handleColumnToggle } = useColumnManagement({
		tagKeys,
        initialVisibleColumns: dashboardState.visibleColumns.length > 0 ? dashboardState.visibleColumns : undefined,
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
		() => filterAlertsByFilters(alerts, dashboardState.filters, getServiceName),
		[alerts, dashboardState.filters, getServiceName]
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
                toast({
                    title: 'Dashboard updated',
                    description: 'Your dashboard has been saved.',
                });
            } else {
                const result = await createDashboardMutation.mutateAsync(dashboardData);
                if (result?.id) {
                    updateDashboardField('id', result.id);
                }
                toast({
                    title: 'Dashboard created',
                    description: 'Your new dashboard has been saved.',
                });
            }
            markAsClean();
        } catch (error) {
            toast({
                title: 'Error saving dashboard',
                description: error instanceof Error ? error.message : 'Failed to save dashboard',
                variant: 'destructive',
            });
        }
	};

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
					navigate('/alerts');
				}
			} else if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
				handleManualRefresh();
			}
		};

		window.addEventListener('keydown', handleKeyPress);
		return () => window.removeEventListener('keydown', handleKeyPress);
	}, [navigate, handleManualRefresh]);

	const cardSize = getCardSize(filteredAlerts.length);

	return (
		<div className="min-h-screen bg-background p-4 flex flex-col">
			<div className="mb-4 flex flex-col gap-4">
                 <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/alerts')} className="gap-2">
						<ArrowLeft className="h-4 w-4" />
						Back to Alerts
					</Button>
                </div>

                <div className="flex items-center justify-between">
                     <div className="flex-1">
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
                            showTvModeButton={false}
                            dashboards={dashboards.map(d => ({ id: d.id, name: d.name }))}
                            onDashboardSelect={(id) => console.log('Selected dashboard:', id)}
                        />
                     </div>

                     <div className="flex items-center gap-2 ml-4 self-start mt-1">
                         <div className="flex items-center bg-muted rounded-lg p-1">
                            <Button
                                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                                className="h-7 px-2 gap-1"
                            >
                                <LayoutGrid className="h-4 w-4" /> Grid
                            </Button>
                            <Button
                                variant={viewMode === 'heatmap' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('heatmap')}
                                className="h-7 px-2 gap-1"
                            >
                                <MapIcon className="h-4 w-4" /> Map
                            </Button>
                        </div>
                         <Badge variant="secondary" className="ml-2 h-7 flex items-center">
                            {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}
                        </Badge>
                     </div>
                </div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center h-64 flex-1">
					<div className="text-center">
						<RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-foreground" />
						<p className="text-foreground">Loading alerts...</p>
					</div>
				</div>
			) : filteredAlerts.length === 0 ? (
				<div className="flex items-center justify-center h-64 flex-1">
					<div className="text-center">
						<CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
						<h2 className="text-xl font-semibold mb-2 text-foreground">No Active Alerts</h2>
						<p className="text-foreground">All systems are operating normally</p>
					</div>
				</div>
			) : viewMode === 'heatmap' ? (
				<div className="flex-1 border rounded-lg overflow-hidden bg-card shadow-sm">
					<AlertsHeatmap
						alerts={filteredAlerts}
						groupBy={dashboardState.groupBy}
						customValueGetter={getAlertValueWithService}
						onDismiss={handleDismissAlert}
						onUndismiss={handleUndismissAlert}
						groupByColumns={dashboardState.groupBy}
						onGroupByChange={(cols) => updateDashboardField('groupBy', cols)}
						availableColumns={GROUPABLE_COLUMNS}
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
							onDismissAlert={handleDismissAlert}
							onUndismissAlert={handleUndismissAlert}
						/>
					))}
				</div>
			)}

			<div className="fixed bottom-4 right-4 text-xs text-foreground bg-background/80 backdrop-blur-sm rounded-lg p-2 border">
				<div className="flex items-center gap-4">
					<span>
						<kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded text-foreground">ESC</kbd>{' '}
						Exit
					</span>
					<span>
						<kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded text-foreground">R</kbd>{' '}
						Refresh
					</span>
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
		</div>
	);
};

export default AlertsTVMode;
