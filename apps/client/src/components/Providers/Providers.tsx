import { useState } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import { useProviderActions, useProviders, useProviderServices, useServiceActions } from './hooks';
import { ProviderContent } from './ProviderContent';
import { ProviderHeader } from './ProviderHeader';
import { ProviderCategory } from './Providers.types';
import { filterProviders } from './Providers.utils';
import { ProviderTabs } from './ProviderTabs';

export const Providers = () => {
	const [searchQuery, setSearchQuery] = useState('');
	const [activeTab, setActiveTab] = useState<ProviderCategory>('all');

	const { providerInstances, setProviderInstances, isLoading, fetchProviders } = useProviders();

	const { loadingServices, setLoadingServices, loadAllProviderServices, refreshProviderServices } =
		useProviderServices(providerInstances, setProviderInstances, isLoading);

	const { handleRefreshProvider, handleDeleteProvider, handleUpdateProvider } = useProviderActions({
		providerInstances,
		setProviderInstances,
		loadingServices,
		setLoadingServices,
		fetchProviders,
		loadAllProviderServices,
		refreshProviderServices,
	});

	const { handleServiceAction, handleAddService, handleDeleteService } = useServiceActions(
		providerInstances,
		setProviderInstances,
		fetchProviders,
		loadAllProviderServices
	);

	const filteredProviders = filterProviders(providerInstances, searchQuery, activeTab);

	return (
		<DashboardLayout>
			<div className="flex flex-col h-full">
				<ProviderHeader
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					onProviderAdded={fetchProviders}
				/>

				<ProviderTabs activeTab={activeTab} onTabChange={setActiveTab} />

				<div className="flex-1 overflow-auto p-4">
					<ProviderContent
						isLoading={isLoading}
						providers={filteredProviders}
						loadingServices={loadingServices}
						searchQuery={searchQuery}
						onRefresh={handleRefreshProvider}
						onUpdateProvider={handleUpdateProvider}
						onDeleteProvider={handleDeleteProvider}
						onAddService={handleAddService}
						onServiceAction={handleServiceAction}
						onDeleteService={handleDeleteService}
						onAddProvider={(type) => {}}
					/>
				</div>
			</div>
		</DashboardLayout>
	);
};

export default Providers;
