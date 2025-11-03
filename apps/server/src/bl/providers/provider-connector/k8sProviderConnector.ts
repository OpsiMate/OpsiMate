import { ProviderConnector } from './providerConnector';
import { DiscoveredService, Provider, Service } from '@OpsiMate/shared';
import { getK8RLogs, getK8RPods } from '../../../dal/kubeConnector';
import { getK8SDeployments, restartK8RDeploymentPods } from '../../../dal/kubeConnectorV2';
import { DiscoveredPod } from '@OpsiMate/shared';

export class K8SProviderConnector implements ProviderConnector {
	async getServiceLogs(provider: Provider, service: Service): Promise<string[]> {
		return [await getK8RLogs(provider, service.name, service.containerDetails?.namespace || 'default')];
	}

	startService(provider: Provider, service: Service): Promise<void> {
		return restartK8RDeploymentPods(provider, service);
	}

	getServicePods(provider: Provider, service: Service): Promise<DiscoveredPod[]> {
		return getK8RPods(provider, service);
	}

	stopService(provider: Provider, service: Service): Promise<void> {
		return restartK8RDeploymentPods(provider, service);
	}

	async discoverServices(provider: Provider): Promise<DiscoveredService[]> {
		return getK8SDeployments(provider);
	}

	testConnection(_: Provider): Promise<{ success: boolean; error?: string }> {
		return Promise.resolve({ success: false, error: 'Kubernetes connection testing is not yet implemented' });
	}
}
