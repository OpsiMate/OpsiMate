import { ProviderConnector } from './providerConnector';
import { DiscoveredService, Provider, Service } from '@OpsiMate/shared';
import {
	getK8SDeploymentLogs,
	getK8SDeploymentPods,
	getK8SDeployments,
	restartK8SDeploymentPods,
} from '../../../dal/kubeConnector';
import { DiscoveredPod } from '@OpsiMate/shared';
import { BashAction } from '@OpsiMate/custom-actions';

export class K8SProviderConnector implements ProviderConnector {
	async getServiceLogs(provider: Provider, service: Service): Promise<string[]> {
		return await getK8SDeploymentLogs(provider, service);
	}

	startService(provider: Provider, service: Service): Promise<void> {
		return restartK8SDeploymentPods(provider, service);
	}

	getServicePods(provider: Provider, service: Service): Promise<DiscoveredPod[]> {
		return getK8SDeploymentPods(provider, service);
	}

	stopService(provider: Provider, service: Service): Promise<void> {
		return restartK8SDeploymentPods(provider, service);
	}

	async discoverServices(provider: Provider): Promise<DiscoveredService[]> {
		return getK8SDeployments(provider);
	}

	testConnection(_: Provider): Promise<{ success: boolean; error?: string }> {
		return Promise.resolve({ success: false, error: 'Kubernetes connection testing is not yet implemented' });
	}

	runCustomAction(
		_provider: Provider,
		_action: BashAction,
		_parameters: Record<string, string>,
		_service?: Service
	): Promise<void> {
		return Promise.reject(new Error('Custom actions are not implemented for K8S'));
	}
}
