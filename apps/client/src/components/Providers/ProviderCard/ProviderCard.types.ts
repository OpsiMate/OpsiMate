import { ServiceConfig } from '@/components/AddServiceDialog';
import { Provider } from '../Providers.types';

export interface ProviderCardProps {
	provider: Provider;
	isLoading: boolean;
	onRefresh: (id: string) => void;
	onUpdateProvider: (provider: Provider) => Promise<void>;
	onDeleteProvider: (provider: Provider) => Promise<boolean>;
	onAddService: (providerId: number, service: ServiceConfig) => void;
	onServiceAction: (providerId: string, serviceId: string, action: 'start' | 'stop' | 'restart') => void;
	onDeleteService: (serviceId: string) => void;
}
