import { DiscoveredPod, DiscoveredService, Provider, Service, ServiceType, Logger } from '@OpsiMate/shared';
import * as sshClient from '../../../dal/sshClient';
import { ProviderConnector } from './providerConnector';
import { BashAction } from '@OpsiMate/custom-actions';

export class VMProviderConnector implements ProviderConnector {
	private logger: Logger = new Logger('vm-connector');

	async discoverServices(provider: Provider): Promise<DiscoveredService[]> {
		return sshClient.connectAndListContainers(provider);
	}

	async startService(provider: Provider, service: Service): Promise<void> {
		if (service.serviceType === ServiceType.SYSTEMD) {
			return sshClient.startSystemService(provider, service.name);
		} else {
			// Default to Docker service
			return sshClient.startService(provider, service.name);
		}
	}

	async stopService(provider: Provider, service: Service): Promise<void> {
		if (service.serviceType === ServiceType.SYSTEMD) {
			return sshClient.stopSystemService(provider, service.name);
		} else {
			// Default to Docker service
			return sshClient.stopService(provider, service.name);
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
		if (!action.script) {
			throw new Error('Missing script for bash action');
		}

		// Resolve placeholders in the script
		const resolvedScript = this.resolvePlaceholders(action.script, parameters);

		this.logger.info(`Executing bash action '${action.name}' on provider ${provider.name}`);

		try {
			const result = await sshClient.executeBashScript(provider, resolvedScript);
			this.logger.info(
				`Bash action '${action.name}' completed successfully. Output: ${result.stdout || '(no output)'}`
			);

			if (result.stderr) {
				this.logger.warn(`Bash action '${action.name}' stderr: ${result.stderr}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			this.logger.error(`Failed to execute bash action '${action.name}': ${errorMessage}`);
			throw new Error(`Failed to execute bash action '${action.name}': ${errorMessage}`);
		}
	}

	private resolvePlaceholders(str: string, parameters: Record<string, string>): string {
		// Replace {{field_name}} style placeholders
		return str.replace(/\{\{(\w+)\}\}/g, (match, fieldName: string) => {
			return parameters[fieldName] !== undefined ? parameters[fieldName] : match;
		});
	}
}
