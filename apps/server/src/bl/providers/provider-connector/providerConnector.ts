import { Provider, DiscoveredService, Service, DiscoveredPod } from '@OpsiMate/shared';

export interface ProviderConnector {
	discoverServices(provider: Provider): Promise<DiscoveredService[]>;

	startService(provider: Provider, service: Service): Promise<void>;

	stopService(provider: Provider, service: Service): Promise<void>;

	getServiceLogs(provider: Provider, service: Service): Promise<string[]>;

	testConnection(provider: Provider): Promise<{ success: boolean; error?: string }>;

	getServicePods(provider: Provider, service: Service): Promise<DiscoveredPod[]>;
}
