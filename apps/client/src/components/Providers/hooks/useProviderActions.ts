import { ServiceConfig } from '@/components/AddServiceDialog';
import { queryKeys } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { providerApi } from '@/lib/api';
import { Logger } from '@OpsiMate/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Provider } from '../Providers.types';

const logger = new Logger('useProviderActions');

interface UseProviderActionsProps {
	providerInstances: Provider[];
	setProviderInstances: React.Dispatch<React.SetStateAction<Provider[]>>;
	loadingServices: Set<number>;
	setLoadingServices: React.Dispatch<React.SetStateAction<Set<number>>>;
	refreshProviderServices: (provider: Provider) => Promise<void>;
}

export const useProviderActions = ({
	providerInstances,
	setProviderInstances,
	loadingServices,
	setLoadingServices,
	refreshProviderServices,
}: UseProviderActionsProps) => {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const handleRefreshProvider = async (id: string) => {
		toast({
			title: 'Refreshing provider',
			description: 'Connecting to server and discovering services...',
		});

		const newLoading = new Set(loadingServices);
		newLoading.add(parseInt(id));
		setLoadingServices(newLoading);

		try {
			const response = await providerApi.refreshProvider(parseInt(id));

			if (response.success && response.data) {
				const { provider: refreshedProvider, services } = response.data;

				const serviceConfigs: ServiceConfig[] = services.map((service) => ({
					id: service.id.toString(),
					name: service.name,
					status: service.serviceStatus as 'running' | 'stopped' | 'error' | 'unknown',
					type: service.serviceType,
					serviceIP: service.serviceIP,
					containerDetails: service.containerDetails || undefined,
				}));

				const updatedProvider: Provider = {
					id: parseInt(id),
					name: refreshedProvider.name,
					providerIP: refreshedProvider.providerIP || '',
					username: refreshedProvider.username || '',
					privateKeyFilename: refreshedProvider.privateKeyFilename,
					SSHPort: refreshedProvider.SSHPort || 22,
					providerType: refreshedProvider.providerType as Provider['providerType'],
					createdAt: refreshedProvider.createdAt || new Date().toISOString(),
					status: services.some((s) => s.serviceStatus === 'running') ? 'online' : 'offline',
					services: serviceConfigs,
				};

				const updatedProviders = providerInstances.map((provider) =>
					provider.id === Number(id) ? updatedProvider : provider
				);

				setProviderInstances(updatedProviders);

				toast({
					title: 'Provider refreshed',
					description: `Discovered ${services.length} services with real-time status`,
				});
			} else {
				throw new Error('Failed to refresh provider');
			}
		} catch (error) {
			logger.error('Error refreshing provider:', error);
			toast({
				title: 'Error refreshing',
				description: 'There was a problem updating the provider status',
				variant: 'destructive',
			});
		} finally {
			const newLoading = new Set(loadingServices);
			newLoading.delete(parseInt(id));
			setLoadingServices(newLoading);
		}
	};

	const handleRowClick = async (provider: Provider, e?: React.MouseEvent) => {
		if (e && (e.target as HTMLElement).closest('[data-radix-popper-content-wrapper]')) {
			return;
		}

		if (!provider.services || provider.services.length === 0) {
			await refreshProviderServices(provider);
		}
	};

	const handleDeleteProvider = async (selectedProvider: Provider | null) => {
		if (!selectedProvider) return;
		try {
			const response = await providerApi.deleteProvider(selectedProvider.id);

			if (response.success) {
				const updatedProviders = providerInstances.filter((provider) => provider.id !== selectedProvider.id);
				setProviderInstances(updatedProviders);

				queryClient.invalidateQueries({ queryKey: queryKeys.services });

				toast({
					title: 'Provider deleted',
					description: `${selectedProvider.name} has been successfully deleted.`,
				});
				return true;
			} else {
				throw new Error(response.error || 'Failed to delete provider');
			}
		} catch (error) {
			logger.error('Error deleting provider:', error);
			toast({
				title: 'Error deleting provider',
				description: 'There was a problem deleting your provider.',
				variant: 'destructive',
			});
			return false;
		}
	};

	const handleUpdateProvider = async (updatedProvider: Provider) => {
		try {
			const updateData = {
				name: updatedProvider.name,
				providerIP: updatedProvider.providerIP || '',
				username: updatedProvider.username || '',
				secretId: updatedProvider.secretId,
				password: updatedProvider.password || '',
				SSHPort: updatedProvider.SSHPort || 22,
				providerType: updatedProvider.providerType,
			};

			const response = await providerApi.updateProvider(updatedProvider.id, updateData);

			if (response.success && response.data) {
				const updatedProviders = providerInstances.map((provider) => {
					if (provider.id === updatedProvider.id) {
						return {
							...provider,
							...updatedProvider,
						};
					}
					return provider;
				});

				setProviderInstances(updatedProviders);
				queryClient.invalidateQueries({ queryKey: queryKeys.services });

				toast({
					title: 'Provider updated',
					description: `${updatedProvider.name} has been successfully updated.`,
				});
			} else {
				throw new Error(response.error || 'Failed to update provider');
			}
		} catch (error) {
			logger.error('Error updating provider:', error);
			toast({
				title: 'Error updating provider',
				description: 'There was a problem updating your provider.',
				variant: 'destructive',
			});
			throw error;
		}
	};

	return {
		handleRefreshProvider,
		handleRowClick,
		handleDeleteProvider,
		handleUpdateProvider,
	};
};
