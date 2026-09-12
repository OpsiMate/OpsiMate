import { useToast } from '@/hooks/use-toast';
import { QueryObserverResult, RefetchOptions } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// Poll for alert updates every five seconds while automatic refresh is enabled.
const ALERTS_REFRESH_INTERVAL_MS = 5 * 1000;

export interface UseAlertsRefreshOptions {
	shouldPause?: boolean;
}

export const useAlertsRefresh = (
	refetch: (options?: RefetchOptions) => Promise<QueryObserverResult>,
	options?: UseAlertsRefreshOptions
) => {
	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
	const [isRefreshing, setIsRefreshing] = useState(false);
	const { toast } = useToast();
	const shouldPause = options?.shouldPause ?? false;

	// Auto-refresh every 5 seconds when not paused
	useEffect(() => {
		if (shouldPause) return;

		const interval = setInterval(() => {
			refetch();
			setLastRefresh(new Date());
		}, ALERTS_REFRESH_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [refetch, shouldPause]);

	const handleManualRefresh = async () => {
		setIsRefreshing(true);
		try {
			await refetch();
			setLastRefresh(new Date());
			toast({
				title: 'Alerts refreshed',
				description: 'The alerts list has been updated.',
			});
		} catch {
			toast({
				title: 'Error refreshing alerts',
				description: 'Failed to refresh alerts',
				variant: 'destructive',
			});
		} finally {
			setIsRefreshing(false);
		}
	};

	return {
		lastRefresh,
		isRefreshing,
		handleManualRefresh,
	};
};
