import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { providerApi } from '@/lib/api';
import { Logger } from '@OpsiMate/shared';
import { ServiceConfig } from '@/components/AddServiceDialog';
import { Provider } from '../Providers.types';

const logger = new Logger('useProviderServices');

export const useProviderServices = (
	providerInstances: Provider[],
	setProviderInstances: React.Dispatch<React.SetStateAction<Provider[]>>,
	isLoading: boolean
) => {
	const { toast } = useToast();
	const [loadingServices, setLoadingServices] = useState<Set<number>>(new Set());

	const loadAllProviderServices = async () => {
		if (providerInstances.length === 0) return;

		try {
			const response = await providerApi.getAllServices();

			if (response.success && response.data) {
				const servicesByProvider = response.data.reduce(
					(acc, service) => {
						const providerId = service.providerId?.toString();
						if (providerId) {
							if (!acc[providerId]) {
								acc[providerId] = [];
							}
							acc[providerId].push({
								id: service.id.toString(),
								name: service.name,
								status: service.serviceStatus as 'running' | 'stopped' | 'error' | 'unknown',
								type: service.serviceType,
								serviceIP: service.serviceIP,
								containerDetails: service.containerDetails || undefined,
							});
						}
						return acc;
					},
					{} as Record<string, ServiceConfig[]>
				);

				const updatedProviders = providerInstances.map((provider) => ({
					...provider,
					services: servicesByProvider[provider.id] || [],
				}));

				setProviderInstances(updatedProviders);
			}
		} catch (error) {
			logger.error('Error loading all provider services:', error);
			toast({
				title: 'Error loading services',
				description: 'There was a problem loading services for your providers',
				variant: 'destructive',
			});
		}
	};

	useEffect(() => {
		if (!isLoading && providerInstances.length > 0) {
			const hasServicesLoaded = providerInstances.some(
				(provider) => provider.services && provider.services.length > 0
			);
			if (!hasServicesLoaded) {
				loadAllProviderServices();
			}
		}
	}, [isLoading, providerInstances.length]);

	const refreshProviderServices = async (provider: Provider) => {
		const providerId = provider.id;
		const newLoading = new Set(loadingServices);
		newLoading.add(providerId);
		setLoadingServices(newLoading);

		try {
			const response = await providerApi.getAllServices();
			if (response.success && response.data) {
				const providerServices = response.data?.filter(
					(service) => service.providerId && service.providerId === provider.id
				);

				const serviceConfigs: ServiceConfig[] = providerServices.map((service) => ({
					id: service.id.toString(),
					name: service.name,
					status: service.serviceStatus as 'running' | 'stopped' | 'error' | 'unknown',
					type: service.serviceType,
					serviceIP: service.serviceIP,
					containerDetails: service.containerDetails || undefined,
				}));

				const updatedProvider = {
					...provider,
					services: serviceConfigs,
				};

				const updatedProviders = providerInstances.map((item) =>
					item.id === provider.id ? updatedProvider : item
				);

				setProviderInstances(updatedProviders);
			}
		} catch (error) {
			logger.error('Error fetching services for provider:', error);
			toast({
				title: 'Error loading services',
				description: 'There was a problem loading services for this provider',
				variant: 'destructive',
			});
		} finally {
			const newLoading = new Set(loadingServices);
			newLoading.delete(providerId);
			setLoadingServices(newLoading);
		}
	};

	return {
		loadingServices,
		setLoadingServices,
		loadAllProviderServices,
		refreshProviderServices,
	};
};
