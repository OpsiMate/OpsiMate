import { useStartService, useStopService } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { Logger } from '@OpsiMate/shared';
import { useCallback } from 'react';
import { Service } from '../../ServiceTable';

const logger = new Logger('useServiceActions');

interface ServiceActionsResult {
	handleStart: (services: Service[]) => Promise<void>;
	handleStop: (services: Service[]) => Promise<void>;
	handleRestart: (services: Service[]) => Promise<void>;
}

export const useServiceActions = (): ServiceActionsResult => {
	const { toast } = useToast();
	const startServiceMutation = useStartService();
	const stopServiceMutation = useStopService();

	const handleStart = useCallback(
		async (services: Service[]) => {
			if (services.length === 0) return;

			toast({
				title: 'Starting Services',
				description: `Starting ${services.length} service${services.length !== 1 ? 's' : ''}...`,
			});

			let successCount = 0;
			let failureCount = 0;

			for (const service of services) {
				try {
					const serviceId = parseInt(service.id);
					await startServiceMutation.mutateAsync(serviceId);
					successCount++;
				} catch (error) {
					failureCount++;
					logger.error(`Error starting service ${service.name}:`, error);
				}
			}

			if (successCount > 0 && failureCount === 0) {
				toast({
					title: 'Services Started',
					description: `Successfully started ${successCount} service${successCount !== 1 ? 's' : ''}.`,
				});
			} else if (successCount > 0 && failureCount > 0) {
				toast({
					title: 'Partial Success',
					description: `Started ${successCount} service${successCount !== 1 ? 's' : ''}, but ${failureCount} failed.`,
					variant: 'default',
				});
			} else {
				toast({
					title: 'Failed to Start Services',
					description: `All ${failureCount} service${failureCount !== 1 ? 's' : ''} failed to start.`,
					variant: 'destructive',
				});
			}
		},
		[toast, startServiceMutation]
	);

	const handleStop = useCallback(
		async (services: Service[]) => {
			if (services.length === 0) return;

			toast({
				title: 'Stopping Services',
				description: `Stopping ${services.length} service${services.length !== 1 ? 's' : ''}...`,
			});

			let successCount = 0;
			let failureCount = 0;

			for (const service of services) {
				try {
					const serviceId = parseInt(service.id);
					await stopServiceMutation.mutateAsync(serviceId);
					successCount++;
				} catch (error) {
					failureCount++;
					logger.error(`Error stopping service ${service.name}:`, error);
				}
			}

			if (successCount > 0 && failureCount === 0) {
				toast({
					title: 'Services Stopped',
					description: `Successfully stopped ${successCount} service${successCount !== 1 ? 's' : ''}.`,
				});
			} else if (successCount > 0 && failureCount > 0) {
				toast({
					title: 'Partial Success',
					description: `Stopped ${successCount} service${successCount !== 1 ? 's' : ''}, but ${failureCount} failed.`,
					variant: 'default',
				});
			} else {
				toast({
					title: 'Failed to Stop Services',
					description: `All ${failureCount} service${failureCount !== 1 ? 's' : ''} failed to stop.`,
					variant: 'destructive',
				});
			}
		},
		[toast, stopServiceMutation]
	);

	const handleRestart = useCallback(
		async (services: Service[]) => {
			if (services.length === 0) return;

			toast({
				title: 'Restarting Services',
				description: `Restarting ${services.length} service${services.length !== 1 ? 's' : ''}...`,
			});

			let successCount = 0;
			let failureCount = 0;

			for (const service of services) {
				try {
					const serviceId = parseInt(service.id);
					await stopServiceMutation.mutateAsync(serviceId);
					await startServiceMutation.mutateAsync(serviceId);
					successCount++;
				} catch (error) {
					failureCount++;
					logger.error(`Error restarting service ${service.name}:`, error);
				}
			}

			if (successCount > 0 && failureCount === 0) {
				toast({
					title: 'Services Restarted',
					description: `Successfully restarted ${successCount} service${successCount !== 1 ? 's' : ''}.`,
				});
			} else if (successCount > 0 && failureCount > 0) {
				toast({
					title: 'Partial Success',
					description: `Restarted ${successCount} service${successCount !== 1 ? 's' : ''}, but ${failureCount} failed.`,
					variant: 'default',
				});
			} else {
				toast({
					title: 'Failed to Restart Services',
					description: `All ${failureCount} service${failureCount !== 1 ? 's' : ''} failed to restart.`,
					variant: 'destructive',
				});
			}
		},
		[toast, startServiceMutation, stopServiceMutation]
	);

	return {
		handleStart,
		handleStop,
		handleRestart,
	};
};
