import { getAlertValue } from '@/components/Alerts/AlertsTable/AlertsTable.utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAlerts, useDismissAlert, useUndismissAlert } from '@/hooks/queries/alerts';
import { useServices } from '@/hooks/queries/services';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { ArrowLeft, Bell, CheckCircle, LayoutGrid, Map, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCard } from './AlertCard';
import { AlertsHeatmap } from './AlertsHeatmap';
import { AUTO_REFRESH_INTERVAL_MS, GRID_CLASSES, GROUPABLE_COLUMNS } from './AlertsTVMode.constants';
import { ViewMode } from './AlertsTVMode.types';
import { createServiceNameLookup, filterAlertsByFilters, getAlertServiceId, getCardSize } from './AlertsTVMode.utils';

const AlertsTVMode = () => {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { toast } = useToast();

	const filters = useMemo(() => {
		try {
			return JSON.parse(searchParams.get('filters') || '{}');
		} catch {
			return {};
		}
	}, [searchParams]);

	const { data: alerts = [], isLoading, refetch } = useAlerts();
	const { data: services = [] } = useServices();
	const dismissAlertMutation = useDismissAlert();
	const undismissAlertMutation = useUndismissAlert();

	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
	const [groupByColumns, setGroupByColumns] = useState<string[]>(['tag']);

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
		() => filterAlertsByFilters(alerts, filters, getServiceName),
		[alerts, filters, getServiceName]
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
			<div className="mb-4 flex items-center justify-between flex-shrink-0">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="sm" onClick={() => navigate('/alerts')} className="gap-2">
						<ArrowLeft className="h-4 w-4" />
						Back to Alerts
					</Button>
					<div className="flex items-center gap-2">
						<Bell className="h-5 w-5 text-muted-foreground" />
						<h1 className="text-xl font-bold">Alerts TV Mode</h1>
						<Badge variant="secondary" className="ml-2">
							{filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}
						</Badge>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex items-center bg-muted rounded-lg p-1 mr-2">
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
							<Map className="h-4 w-4" /> Map
						</Button>
					</div>

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
					{lastRefresh && (
						<span className="text-xs text-muted-foreground">Last: {lastRefresh.toLocaleTimeString()}</span>
					)}
				</div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center h-64 flex-1">
					<div className="text-center">
						<RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
						<p className="text-muted-foreground">Loading alerts...</p>
					</div>
				</div>
			) : filteredAlerts.length === 0 ? (
				<div className="flex items-center justify-center h-64 flex-1">
					<div className="text-center">
						<CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
						<h2 className="text-xl font-semibold mb-2">No Active Alerts</h2>
						<p className="text-muted-foreground">All systems are operating normally</p>
					</div>
				</div>
			) : viewMode === 'heatmap' ? (
				<div className="flex-1 border rounded-lg overflow-hidden bg-card shadow-sm">
					<AlertsHeatmap
						alerts={filteredAlerts}
						groupBy={groupByColumns}
						customValueGetter={getAlertValueWithService}
						onDismiss={handleDismissAlert}
						onUndismiss={handleUndismissAlert}
						groupByColumns={groupByColumns}
						onGroupByChange={setGroupByColumns}
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

			<div className="fixed bottom-4 right-4 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded-lg p-2 border">
				<div className="flex items-center gap-4">
					<span>
						<kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded">ESC</kbd> Exit
					</span>
					<span>
						<kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded">R</kbd> Refresh
					</span>
				</div>
			</div>
		</div>
	);
};

export default AlertsTVMode;
