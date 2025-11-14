import { useToast } from '@/hooks/use-toast';
import { providerApi } from '@/lib/api';
import { Logger } from '@OpsiMate/shared';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/queries';
import { ServiceConfig } from '@/components/AddServiceDialog';
import { Provider } from '../Providers.types';

const logger = new Logger('useServiceActions');

export const useServiceActions = (
	providerInstances: Provider[],
	setProviderInstances: React.Dispatch<React.SetStateAction<Provider[]>>,
	fetchProviders: () => Promise<void>,
	loadAllProviderServices: () => Promise<void>
) => {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const handleServiceAction = async (providerId: string, serviceId: string, action: 'start' | 'stop' | 'restart') => {
		try {
			const serviceIdNum = parseInt(serviceId);

			if (action === 'start') {
				const response = await providerApi.startService(serviceIdNum);
				if (!response.success) throw new Error(response.error || 'Failed to start service');
			} else if (action === 'stop') {
				const response = await providerApi.stopService(serviceIdNum);
				if (!response.success) throw new Error(response.error || 'Failed to stop service');
			} else if (action === 'restart') {
				await providerApi.stopService(serviceIdNum);
				setTimeout(async () => {
					await providerApi.startService(serviceIdNum);
				}, 1000);
			}

			toast({
				title: `Service ${action}ed`,
				description: `Service has been ${action}ed successfully`,
			});
		} catch (error) {
			logger.error(`Error ${action}ing service:`, error);
			toast({
				title: `Error ${action}ing service`,
				description: error instanceof Error ? error.message : `Failed to ${action} service`,
				variant: 'destructive',
			});
		}
	};

	const handleAddService = async (providerId: number, service: ServiceConfig) => {
		try {
			setProviderInstances((prevProviders) => {
				const updatedProviders = prevProviders.map((provider) => {
					if (provider.id === providerId) {
						return {
							...provider,
							services: [service, ...(provider.services ?? [])],
						};
					}
					return provider;
				});
				logger.info('Updated providers after service addition:', { extraArgs: { updatedProviders } });
				return updatedProviders;
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.services });
			toast({
				title: 'Service added',
				description: `${service.name} has been successfully added`,
			});
		} catch (error) {
			logger.error('Error adding service:', error);
			toast({
				title: 'Error adding service',
				description: 'There was a problem adding the service',
				variant: 'destructive',
			});
		}
	};

	const handleDeleteService = async (serviceId: string) => {
		try {
			const serviceIdNum = parseInt(serviceId);

			const containingProvider = providerInstances.find((provider) =>
				provider.services?.some((service) => service.id === serviceId)
			);

			if (!containingProvider) {
				toast({
					title: 'Service not found',
					description: 'Could not find the service to delete',
					variant: 'destructive',
				});
				return;
			}

			const response = await providerApi.deleteService(serviceIdNum);

			if (response.success) {
				await fetchProviders();
				setTimeout(async () => {
					await loadAllProviderServices();
				}, 100);

				queryClient.invalidateQueries({ queryKey: queryKeys.services });

				toast({
					title: 'Service deleted',
					description: 'The service has been successfully deleted.',
				});
			} else {
				throw new Error(response.error || 'Failed to delete service');
			}
		} catch (error) {
			logger.error('Error deleting service:', error);
			toast({
				title: 'Error deleting service',
				description: error instanceof Error ? error.message : 'There was a problem deleting the service',
				variant: 'destructive',
			});
		}
	};

	return {
		handleServiceAction,
		handleAddService,
		handleDeleteService,
	};
};
