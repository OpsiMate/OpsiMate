import { ServiceConfig } from '@/components/AddServiceDialog';
import { ProviderType } from '@OpsiMate/shared';
import { Cloud, Container, Server } from 'lucide-react';
import { Provider, ProviderCategory } from './Providers.types';

export const getProviderIcon = (type: ProviderType) => {
	switch (type) {
		case ProviderType.VM:
			return <Cloud className="h-5 w-5" />;
		case ProviderType.K8S:
			return <Container className="h-5 w-5" />;
		default:
			return <Server className="h-5 w-5" />;
	}
};

export const getProviderTypeName = (type: ProviderType): string => {
	switch (type) {
		case ProviderType.VM:
			return 'VM';
		case ProviderType.K8S:
			return 'Kubernetes';
		default:
			return type;
	}
};

export const getProviderCategory = (type: ProviderType): ProviderCategory => {
	switch (type) {
		case ProviderType.VM:
			return 'server';
		case ProviderType.K8S:
			return 'kubernetes';
		default:
			return 'cloud';
	}
};

export const getStatusBadgeColor = (status?: Provider['status']) => {
	switch (status) {
		case 'online':
			return 'bg-green-500/20 text-green-700 hover:bg-green-500/30';
		case 'offline':
			return 'bg-red-500/20 text-red-700 hover:bg-red-500/30';
		case 'warning':
			return 'bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30';
		case 'unknown':
		default:
			return 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30';
	}
};

export const getServiceStatusBadgeColor = (status: ServiceConfig['status']) => {
	switch (status.toLowerCase()) {
		case 'running':
			return 'bg-green-500/20 text-green-700 hover:bg-green-500/30';
		case 'stopped':
			return 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30';
		case 'error':
			return 'bg-red-500/20 text-red-700 hover:bg-red-500/30';
		case 'unknown':
		default:
			return 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30';
	}
};

export const filterProviders = (
	providers: Provider[],
	searchQuery: string,
	activeTab: ProviderCategory
): Provider[] => {
	return providers.filter((provider) => {
		const name = provider?.name || '';
		const type = provider?.providerType || ProviderType.VM;
		const matchesSearch =
			name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			type.toLowerCase().includes(searchQuery.toLowerCase());

		const matchesTab = activeTab === 'all' || getProviderCategory(type) === activeTab;

		return matchesSearch && matchesTab;
	});
};
