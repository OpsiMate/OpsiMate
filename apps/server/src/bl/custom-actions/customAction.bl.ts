import { Logger } from '@OpsiMate/shared';
import { CustomActionRepository } from '../../dal/customActionRepository';
import { CustomAction } from '@OpsiMate/custom-actions';
import { ProviderBL } from '../providers/provider.bl';
import { ServicesBL } from '../services/services.bl';
import { providerConnectorFactory } from '../providers/provider-connector/providerConnectorFactory';

const logger: Logger = new Logger('bl/custom-actions');

export class CustomActionBL {
	constructor(
		private repo: CustomActionRepository,
		private providerBL: ProviderBL,
		private servicesBL: ServicesBL
	) {}

	async create(data: CustomAction): Promise<number> {
		// Remove id if present since it's auto-generated
		const { id, ...dataWithoutId } = data;
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
		const action = await this.repo.getById(actionId);
		if (!action) {
			throw new Error('Action not found');
		}

		const connector = providerConnectorFactory(provider.providerType);
		await connector.runCustomAction(provider, action);
		logger.info(`Ran custom action id=${actionId} on provider id=${providerId}`);
	}

	async runForService(serviceId: number, actionId: number): Promise<void> {
		const service = await this.servicesBL.getServiceById(serviceId);
		if (!service) {
			throw new Error('Service not found');
		}
		const provider = await this.providerBL.getProviderById(service.providerId);
		const action = await this.repo.getById(actionId);
		if (!action) {
			throw new Error('Action not found');
		}

		const connector = providerConnectorFactory(provider.providerType);
		await connector.runCustomAction(provider, action, service);
		logger.info(`Ran custom action id=${actionId} on service id=${serviceId}`);
	}
}


