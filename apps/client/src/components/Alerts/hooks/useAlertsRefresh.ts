import { useToast } from '@/hooks/use-toast';
import { QueryObserverResult, RefetchOptions } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export const useAlertsRefresh = (refetch: (options?: RefetchOptions) => Promise<QueryObserverResult>) => {
	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
	const [isRefreshing, setIsRefreshing] = useState(false);
	const { toast } = useToast();

	// Auto-refresh every 5 seconds when no dialog is open
	useEffect(() => {
		const interval = setInterval(() => {
			const hasOpenDialog =
				document.querySelector('[role="dialog"]') || document.querySelector('[data-state="open"]');

			if (!hasOpenDialog) {
				refetch();
				setLastRefresh(new Date());
			}
		}, 5000);

		return () => clearInterval(interval);
	}, [refetch]);

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

	return {
		lastRefresh,
		isRefreshing,
		handleManualRefresh,
	};
};
