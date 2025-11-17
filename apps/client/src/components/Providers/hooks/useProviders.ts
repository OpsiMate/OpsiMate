import { useToast } from '@/hooks/use-toast';
import { providerApi } from '@/lib/api';
import { Logger, ProviderType } from '@OpsiMate/shared';
import { useEffect, useState } from 'react';
import { mockProviderInstances } from '../Providers.constants';
import { Provider } from '../Providers.types';

const logger = new Logger('useProviders');

export const useProviders = () => {
	const { toast } = useToast();
	const [providerInstances, setProviderInstances] = useState<Provider[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const fetchProviders = async () => {
		setIsLoading(true);
		try {
			const response = await providerApi.getProviders();

			if (response.success && response.data && response.data.providers) {
				const apiProviders: Provider[] = response.data.providers.map((provider) => {
					const mappedProvider: Provider = {
						id: Number(provider.id),
						name: provider.name || '',
						providerIP: provider.providerIP || '',
						username: provider.username || '',
						privateKeyFilename: provider.privateKeyFilename || '',
						SSHPort: provider.SSHPort || 22,
						providerType: (provider.providerType as ProviderType) || ProviderType.VM,
						createdAt: provider.createdAt
							? new Date(provider.createdAt).toISOString()
							: new Date().toISOString(),
					};

					return mappedProvider;
				});

				setProviderInstances(apiProviders);
			} else if (
				import.meta.env.DEV &&
				(!response.data || !response.data.providers || response.data.providers.length === 0)
			) {
				setProviderInstances(mockProviderInstances);
			}
		} catch (error) {
			logger.error('Error loading providers:', error);
			toast({
				title: 'Error loading providers',
				description: 'There was a problem loading your providers',
				variant: 'destructive',
			});

			if (import.meta.env.DEV) {
				setProviderInstances(mockProviderInstances);
			}
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchProviders();
	}, []);

	return {
		providerInstances,
		setProviderInstances,
		isLoading,
		fetchProviders,
	};
};
