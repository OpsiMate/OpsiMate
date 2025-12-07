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
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground">Alerts</h1>
					<p className="text-sm text-foreground mt-1">Monitor and manage system alerts</p>
				</div>
				<div className="flex items-center gap-2">
					<Button size="sm" onClick={onRefresh} disabled={isRefreshing} className="gap-2">
						<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
						Refresh
					</Button>
					<Button size="sm" onClick={onLaunchTVMode} className="gap-2">
						<Tv className="h-4 w-4" />
						TV Mode
					</Button>
				</div>
			</div>
			{lastRefresh && (
				<p className="text-xs text-foreground mt-2">Last refreshed: {lastRefresh.toLocaleTimeString()}</p>
			)}
		</div>
	);
};
