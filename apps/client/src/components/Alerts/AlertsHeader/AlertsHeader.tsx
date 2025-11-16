import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw, Tv } from 'lucide-react';

export interface AlertsHeaderProps {
	alertsCount: number;
	isRefreshing: boolean;
	lastRefresh: Date | null;
	onRefresh: () => void;
	onLaunchTVMode: () => void;
}

export const AlertsHeader = ({
	alertsCount,
	isRefreshing,
	lastRefresh,
	onRefresh,
	onLaunchTVMode,
}: AlertsHeaderProps) => {
	return (
		<div className="mb-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
					<p className="text-sm text-muted-foreground mt-1">Monitor and manage system alerts</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing} className="gap-2">
						<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
						Refresh
					</Button>
					<Button variant="outline" size="sm" onClick={onLaunchTVMode} className="gap-2">
						<Tv className="h-4 w-4" />
						TV Mode
					</Button>
				</div>
			</div>
			{alertsCount > 0 && lastRefresh && (
				<p className="text-xs text-muted-foreground mt-2">Last refreshed: {lastRefresh.toLocaleTimeString()}</p>
			)}
		</div>
	);
};
