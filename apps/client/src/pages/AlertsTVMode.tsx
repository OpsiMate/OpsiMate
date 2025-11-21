import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAlerts, useDismissAlert, useUndismissAlert } from '@/hooks/queries/alerts';
import { useServices } from '@/hooks/queries/services';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import {
	AlertCircle,
	ArrowLeft,
	Bell,
	BellOff,
	CheckCircle,
	ExternalLink,
	MoreVertical,
	RefreshCw,
	RotateCcw,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

type CardSize = 'large' | 'medium' | 'small' | 'extra-small';

const AlertsTVMode = () => {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { toast } = useToast();

	// Parse URL parameters
	const filters = useMemo(() => {
		try {
			return JSON.parse(searchParams.get('filters') || '{}');
		} catch {
			return {};
		}
	}, [searchParams]);

	const visibleColumns = useMemo(() => {
		try {
			return JSON.parse(searchParams.get('visibleColumns') || '[]');
		} catch {
			return ['alertName', 'status', 'tag', 'startsAt', 'serviceName'];
		}
	}, [searchParams]);

	// Fetch data
	const { data: alerts = [], isLoading, refetch } = useAlerts();
	const { data: services = [] } = useServices();
	const dismissAlertMutation = useDismissAlert();
	const undismissAlertMutation = useUndismissAlert();

	// State
	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Create service name lookup map
	const serviceNameById = useMemo(() => {
		const map: Record<string | number, string> = {};
		services.forEach((s) => {
			map[s.id] = s.name;
		});
		return map;
	}, [services]);

	// Extract service ID from alert
	const getAlertServiceId = (alert: Alert): number | undefined => {
		const parts = alert.id.split(':');
		if (parts.length >= 2) {
			const n = Number(parts[1]);
			return Number.isFinite(n) ? n : undefined;
		}
		return undefined;
	};

	// Get service name for alert
	const getServiceName = (alert: Alert): string => {
		const serviceId = getAlertServiceId(alert);
		if (!serviceId) return '-';
		return serviceNameById[serviceId] || `#${serviceId}`;
	};

	// Filter alerts based on filters
	const filteredAlerts = useMemo(() => {
		if (Object.keys(filters).length === 0) return alerts;

		return alerts.filter((alert) => {
			for (const [field, values] of Object.entries(filters)) {
				if (!values || (values as string[]).length === 0) continue;

				let fieldValue: string;
				switch (field) {
					case 'status':
						fieldValue = alert.isDismissed ? 'Dismissed' : 'Firing';
						break;
					case 'tag':
						fieldValue = alert.tag;
						break;
					case 'serviceName': {
						const serviceName = getServiceName(alert);
						fieldValue = serviceName;
						break;
					}
					default:
						continue;
				}

				if (!(values as string[]).includes(fieldValue)) {
					return false;
				}
			}
			return true;
		});
	}, [alerts, filters, serviceNameById]);

	// Auto-refresh every 30 seconds
	useEffect(() => {
		const interval = setInterval(() => {
			refetch();
			setLastRefresh(new Date());
		}, 30000);

		return () => clearInterval(interval);
	}, [refetch]);

	// Manual refresh
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

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyPress = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				navigate('/alerts');
			} else if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
				handleManualRefresh();
			}
		};

		window.addEventListener('keydown', handleKeyPress);
		return () => window.removeEventListener('keydown', handleKeyPress);
	}, [navigate, handleManualRefresh]);

	// Determine card size based on alert count
	const getCardSize = (count: number): CardSize => {
		if (count <= 6) return 'large';
		if (count <= 12) return 'medium';
		if (count <= 48) return 'small';
		return 'extra-small';
	};

	const cardSize = getCardSize(filteredAlerts.length);

	// Get grid classes based on card size
	const getGridClasses = (size: CardSize) => {
		switch (size) {
			case 'large':
				return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
			case 'medium':
				return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3';
			case 'small':
				return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2';
			case 'extra-small':
				return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1';
		}
	};

	// Get status icon
	const getStatusIcon = (alert: Alert) => {
		if (alert.isDismissed) {
			return <BellOff className="h-4 w-4 text-muted-foreground" />;
		}
		return <AlertCircle className="h-4 w-4 text-destructive" />;
	};

	// Get status color
	const getStatusColor = (alert: Alert) => {
		if (alert.isDismissed) {
			return 'border-muted bg-muted/10';
		}
		return 'border-destructive bg-destructive/10';
	};

	// Render alert card
	const renderAlertCard = (alert: Alert) => {
		const serviceName = getServiceName(alert);
		const showDetails = cardSize === 'large' || cardSize === 'medium';
		const showSummary = cardSize === 'large';

		return (
			<Card
				key={alert.id}
				className={cn(
					'transition-all hover:shadow-lg cursor-pointer relative overflow-hidden',
					getStatusColor(alert)
				)}
			>
				<CardHeader className={cn('pb-2', cardSize === 'extra-small' ? 'p-2' : 'p-3')}>
					<div className="flex items-start justify-between gap-1">
						<div className="flex items-start gap-2 flex-1 min-w-0">
							{getStatusIcon(alert)}
							<div className="flex-1 min-w-0">
								<h3
									className={cn(
										'font-semibold truncate',
										cardSize === 'extra-small' ? 'text-xs' : 'text-sm'
									)}
									title={alert.alertName}
								>
									{alert.alertName}
								</h3>
								{showDetails && (
									<div className="flex items-center gap-2 mt-1">
										<Badge variant="outline" className="text-[10px] px-1 py-0">
											{alert.tag}
										</Badge>
										{serviceName !== '-' && (
											<span className="text-[10px] text-muted-foreground truncate">
												{serviceName}
											</span>
										)}
									</div>
								)}
							</div>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className={cn('h-5 w-5 p-0', cardSize === 'extra-small' && 'h-4 w-4')}
									onClick={(e) => e.stopPropagation()}
								>
									<MoreVertical className="h-3 w-3" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{alert.runbookUrl && (
									<DropdownMenuItem
										onClick={() => window.open(alert.runbookUrl, '_blank', 'noopener,noreferrer')}
									>
										<span className="mr-2">📖</span>
										Open Runbook
									</DropdownMenuItem>
								)}
								{alert.alertUrl && (
									<DropdownMenuItem
										onClick={() => window.open(alert.alertUrl, '_blank', 'noopener,noreferrer')}
									>
										<ExternalLink className="mr-2 h-3 w-3" />
										View in Grafana
									</DropdownMenuItem>
								)}
								{alert.isDismissed ? (
									<DropdownMenuItem onClick={() => handleUndismissAlert(alert.id)}>
										<RotateCcw className="mr-2 h-3 w-3" />
										Undismiss Alert
									</DropdownMenuItem>
								) : (
									<DropdownMenuItem onClick={() => handleDismissAlert(alert.id)}>
										<X className="mr-2 h-3 w-3" />
										Dismiss Alert
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</CardHeader>
				{showSummary && alert.summary && (
					<CardContent className="pt-0 pb-3 px-3">
						<p className="text-xs text-muted-foreground line-clamp-2">{alert.summary}</p>
					</CardContent>
				)}
				{showDetails && (
					<div className="px-3 pb-2">
						<p className="text-[10px] text-muted-foreground">
							Started:{' '}
							{(() => {
								const date = new Date(alert.startsAt);
								return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString();
							})()}
						</p>
					</div>
				)}
			</Card>
		);
	};

	return (
		<div className="min-h-screen bg-background p-4">
			{/* Header */}
			<div className="mb-4 flex items-center justify-between">
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

			{/* Alert Grid */}
			{isLoading ? (
				<div className="flex items-center justify-center h-64">
					<div className="text-center">
						<RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
						<p className="text-muted-foreground">Loading alerts...</p>
					</div>
				</div>
			) : filteredAlerts.length === 0 ? (
				<div className="flex items-center justify-center h-64">
					<div className="text-center">
						<CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
						<h2 className="text-xl font-semibold mb-2">No Active Alerts</h2>
						<p className="text-muted-foreground">All systems are operating normally</p>
					</div>
				</div>
			) : (
				<div className={cn('grid', getGridClasses(cardSize))}>{filteredAlerts.map(renderAlertCard)}</div>
			)}

			{/* Footer with keyboard shortcuts */}
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
