import { ServiceConfig } from '@/components/AddServiceDialog';
import { ClientProviderType } from '@OpsiMate/shared';
import { EmptyState } from '../EmptyState';
import { ProviderCard } from '../ProviderCard';
import { Provider } from '../Providers.types';

interface ProviderContentProps {
	isLoading: boolean;
	providers: Provider[];
	loadingServices: Set<number>;
	searchQuery: string;
	onRefresh: (id: string) => void;
	onUpdateProvider: (provider: Provider) => Promise<void>;
	onDeleteProvider: (provider: Provider) => Promise<boolean>;
	onAddService: (providerId: number, service: ServiceConfig) => void;
	onServiceAction: (providerId: string, serviceId: string, action: 'start' | 'stop' | 'restart') => void;
	onDeleteService: (serviceId: string) => void;
	onAddProvider: (type: ClientProviderType) => void;
}

export const ProviderContent = ({
	isLoading,
	providers,
	loadingServices,
	searchQuery,
	onRefresh,
	onUpdateProvider,
	onDeleteProvider,
	onAddService,
	onServiceAction,
	onDeleteService,
	onAddProvider,
}: ProviderContentProps) => {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
			</div>
		);
	}

	if (providers.length === 0) {
		return <EmptyState searchQuery={searchQuery} onAddProvider={onAddProvider} />;
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
			{providers.map((provider) => (
				<ProviderCard
					key={provider.id}
					provider={provider}
					isLoading={loadingServices.has(provider.id)}
					onRefresh={onRefresh}
					onUpdateProvider={onUpdateProvider}
					onDeleteProvider={onDeleteProvider}
					onAddService={onAddService}
					onServiceAction={onServiceAction}
					onDeleteService={onDeleteService}
				/>
			))}
		</div>
	);
};
