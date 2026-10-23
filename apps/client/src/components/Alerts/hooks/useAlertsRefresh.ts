import { useToast } from '@/hooks/use-toast';
import { ACTIVE_ALERTS_POLL_MS } from '@/lib/pollIntervals';
import { QueryObserverResult, RefetchOptions } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

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
			// Join a fetch that is still running instead of cancelling it: a cancelled manual
			// refresh resolves with the old, successful result and hides its error. The joined
			// fetch can still fail, so move lastRefresh only once it has succeeded.
			refetch({ cancelRefetch: false })
				.then((result) => {
					if (!result.isError) setLastRefresh(new Date());
				})
				// A failed poll keeps the old timestamp; the next tick tries again.
				.catch(() => {});
		}, ACTIVE_ALERTS_POLL_MS);

		return () => clearInterval(interval);
	}, [refetch, shouldPause]);

	const handleManualRefresh = async () => {
		setIsRefreshing(true);
		try {
			// refetch() resolves with an error result instead of throwing, so check it here.
			const result = await refetch();
			if (result.isError) throw result.error;
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
