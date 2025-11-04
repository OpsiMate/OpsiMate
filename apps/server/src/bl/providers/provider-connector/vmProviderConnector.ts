import { DiscoveredPod, DiscoveredService, Provider, Service, ServiceType, Logger } from '@OpsiMate/shared';
import * as sshClient from '../../../dal/sshClient';
import { ProviderConnector } from './providerConnector';
import { BashAction } from '@OpsiMate/custom-actions';

export class VMProviderConnector implements ProviderConnector {
	private logger: Logger = new Logger('vm-connector');

	async discoverServices(provider: Provider): Promise<DiscoveredService[]> {
		return sshClient.connectAndListContainers(provider);
	}

	async startService(provider: Provider, serviceName: string, serviceType?: ServiceType): Promise<void> {
		if (serviceType === ServiceType.SYSTEMD) {
			return sshClient.startSystemService(provider, serviceName);
		} else {
			// Default to Docker service
			return sshClient.startService(provider, serviceName);
		}
	}

	async stopService(provider: Provider, serviceName: string, serviceType?: ServiceType): Promise<void> {
		if (serviceType === ServiceType.SYSTEMD) {
			return sshClient.stopSystemService(provider, serviceName);
		} else {
			// Default to Docker service
			return sshClient.stopService(provider, serviceName);
		}
	}

	async getServiceLogs(provider: Provider, service: Service): Promise<string[]> {
		if (service.serviceType === ServiceType.SYSTEMD) {
			return sshClient.getSystemServiceLogs(provider, service.name);
		} else {
			// Default to Docker service
			return sshClient.getServiceLogs(provider, service.name);
		}
	}

	async testConnection(provider: Provider): Promise<{ success: boolean; error?: string }> {
		return sshClient.testConnection(provider);
	}

	getServicePods(_: Provider, _2: Service): Promise<DiscoveredPod[]> {
		throw new Error('Method not implemented.');
	}

	async runCustomAction(
		provider: Provider,
		action: BashAction,
		parameters: Record<string, string>,
		_service?: Service
	): Promise<void> {
		if (!action.script) throw new Error('Missing script for bash action');

		// Resolve placeholders in the script
		const _resolvedScript = this.resolvePlaceholders(action.script, parameters);

		this.logger.info(`Executing bash action '${action.name}' on provider ${provider.name}`);
		await sshClient.testConnection(provider);
		// TODO: Execute the resolvedScript via SSH
	}

	private resolvePlaceholders(str: string, parameters: Record<string, string>): string {
		// Replace {{field_name}} style placeholders
		return str.replace(/\{\{(\w+)\}\}/g, (match, fieldName: string) => {
			return parameters[fieldName] !== undefined ? parameters[fieldName] : match;
		});
	}
}
