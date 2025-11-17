import { Logger } from '@OpsiMate/shared';
import { CustomActionRepository } from '../../dal/customActionRepository';
import { CustomAction, HttpAction } from '@OpsiMate/custom-actions';
import { ProviderBL } from '../providers/provider.bl';
import { ServicesBL } from '../services/services.bl';
import { ServiceCustomFieldBL } from '../custom-fields/serviceCustomField.bl';
import { providerConnectorFactory } from '../providers/provider-connector/providerConnectorFactory';
import { Provider, Service } from '@OpsiMate/shared';

const logger: Logger = new Logger('bl/custom-actions');

export class CustomActionBL {
	constructor(
		private repo: CustomActionRepository,
		private providerBL: ProviderBL,
		private servicesBL: ServicesBL,
		private serviceCustomFieldBL: ServiceCustomFieldBL
	) {}

	async create(data: CustomAction): Promise<number> {
		// Remove id if present since it's auto-generated
		const { id: _, ...dataWithoutId } = data;
		const res = await this.repo.create(dataWithoutId);
		logger.info(`Created custom action id=${res.lastID}`);
		return res.lastID;
	}

	list(): Promise<CustomAction[]> {
		return this.repo.list();
	}

	getById(id: number): Promise<CustomAction | undefined> {
		return this.repo.getById(id);
	}

	async update(id: number, data: CustomAction): Promise<void> {
		// Remove id if present since we use the parameter id
		const { id: _, ...dataWithoutId } = data;
		await this.repo.update(id, dataWithoutId);
		logger.info(`Updated custom action id=${id}`);
	}

	async delete(id: number): Promise<void> {
		await this.repo.delete(id);
		logger.info(`Deleted custom action id=${id}`);
	}

	async runForProvider(providerId: number, actionId: number): Promise<void> {
		const provider = await this.providerBL.getProviderById(providerId);
		await this.executeAction(provider, actionId);
		logger.info(`Ran custom action id=${actionId} on provider id=${providerId}`);
	}

	async runForService(serviceId: number, actionId: number): Promise<void> {
		const service = await this.servicesBL.getServiceById(serviceId);
		if (!service) {
			throw new Error('Service not found');
		}
		const provider = await this.providerBL.getProviderById(service.providerId);
		await this.executeAction(provider, actionId, service);
		logger.info(`Ran custom action id=${actionId} on service id=${serviceId}`);
	}

	private async executeAction(provider: Provider, actionId: number, service?: Service): Promise<void> {
		const action = await this.repo.getById(actionId);
		if (!action) {
			throw new Error('Action not found');
		}

		const parameters = await this.buildParametersMap(provider, service);

		if (action.type === 'http') {
			await this.runHttpAction(action, provider, service, parameters);
		} else {
			const connector = providerConnectorFactory(provider.providerType);
			await connector.runCustomAction(provider, action, parameters, service);
		}
	}

	private async runHttpAction(
		action: HttpAction,
		provider: Provider,
		service: Service | undefined,
		parameters: Record<string, string>
	): Promise<void> {
		try {
			const url = this.resolvePlaceholders(action.url, parameters);

			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
				...(action.headers || {}),
			};

			// Resolve placeholders in header values
			const resolvedHeaders: Record<string, string> = {};
			for (const [key, value] of Object.entries(headers)) {
				resolvedHeaders[key] = this.resolvePlaceholders(value, parameters);
			}

			const requestOptions: RequestInit = {
				method: action.method,
				headers: resolvedHeaders,
			};

			if (action.body && (action.method === 'POST' || action.method === 'PUT' || action.method === 'PATCH')) {
				requestOptions.body = this.resolvePlaceholders(action.body, parameters);
			}

			logger.info(
				`Executing HTTP action '${action.name}' (${action.method} ${url}) on provider ${provider.name}${service ? ` for service ${service.name}` : ''}`
			);

			const response = await fetch(url, requestOptions);

			if (!response.ok) {
				const errorText = await response.text().catch(() => 'Unknown error');
				throw new Error(`HTTP action failed: ${response.status} ${response.statusText} - ${errorText}`);
			}

			logger.info(`HTTP action '${action.name}' completed successfully with status ${response.status}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error(`Failed to execute HTTP action '${action.name}': ${errorMessage}`);
			throw error;
		}
	}

	private getProviderParameters(provider: Provider): Record<string, string> {
		return {
			providerId: provider.id.toString(),
			providerName: provider.name,
			ip: provider.providerIP || '',
			host: provider.providerIP || '',
			port: provider.SSHPort?.toString() || '',
		};
	}

	private async getServiceParameters(service: Service): Promise<Record<string, string>> {
		const parameters: Record<string, string> = {
			serviceId: service.id.toString(),
			serviceName: service.name,
			serviceProviderId: service.providerId.toString(),
		};

		// Fetch custom fields for the service
		try {
			const customFieldValues = await this.serviceCustomFieldBL.getCustomFieldValuesForService(service.id);
			const customFields = await this.serviceCustomFieldBL.getCustomFields();

			// Create a map of customFieldId to field name
			const fieldIdToName: Record<number, string> = {};
			customFields.forEach((field) => {
				fieldIdToName[field.id] = field.name;
			});

			// Add custom field values to parameters using field names as keys
			customFieldValues.forEach((value) => {
				const fieldName = fieldIdToName[value.customFieldId];
				if (fieldName) {
					parameters[fieldName] = value.value;
				}
			});
		} catch (error) {
			logger.warn(
				`Failed to fetch custom fields for service ${service.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			// Continue without custom fields if fetch fails
		}

		return parameters;
	}

	private async buildParametersMap(provider: Provider, service?: Service): Promise<Record<string, string>> {
		const parameters = this.getProviderParameters(provider);

		// Add service parameters if service is available
		if (service) {
			const serviceParams = await this.getServiceParameters(service);
			Object.assign(parameters, serviceParams);
		}

		return parameters;
	}

	private resolvePlaceholders(str: string, parameters: Record<string, string>): string {
		// Replace {{field_name}} style placeholders
		return str.replace(/\{\{(\w+)\}\}/g, (match, fieldName: string) => {
			return parameters[fieldName] !== undefined ? parameters[fieldName] : match;
		});
	}
}
