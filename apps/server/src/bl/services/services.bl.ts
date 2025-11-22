import { Service, Logger, User } from '@OpsiMate/shared';
import { ServiceRepository } from '../../dal/serviceRepository';
import { AuditBL } from '../audit/audit.bl';
import { AuditActionType, AuditResourceType } from '@OpsiMate/shared';
import { ServiceNotFound } from './ServiceNotFound';

const logger = new Logger('bl/services/service.bl');

export class ServicesBL {
	constructor(
		private serviceRepo: ServiceRepository,
		private auditBL: AuditBL
	) {}

	async createService(serviceToCreate: Omit<Service, 'id' | 'createdAt'>, user: User): Promise<Service> {
		try {
			logger.info(`Starting to create service`, { extraArgs: { ...serviceToCreate } });

			const { lastID } = await this.serviceRepo.createService(serviceToCreate);
			logger.info(`Service created with ID: ${lastID}`);

			const createdService = await this.serviceRepo.getServiceById(lastID);

			if (!createdService) {
				logger.error(`Failed to fetch service immediately after creation with ID: ${lastID}`);
				throw new ServiceNotFound(lastID);
			}

			await this.auditBL.logAction({
				actionType: AuditActionType.CREATE,
				resourceType: AuditResourceType.SERVICE,
				resourceId: String(lastID),
				userId: user.id,
				userName: user.fullName,
				resourceName: serviceToCreate.name,
			});

			return createdService;
		} catch (error) {
			logger.error(`Error creating service`, error);
			throw error;
		}
	}

	async deleteService(serviceId: number, user: User): Promise<void> {
		logger.info(`Starting to delete service: ${serviceId}`);

		const serviceToDelete = await this.serviceRepo.getServiceById(serviceId);
		if (!serviceToDelete) {
			logger.error('Unable to delete service ${serviceId}, not found');
			throw new ServiceNotFound(serviceId);
		}

		try {
			await this.serviceRepo.deleteService(serviceId);
			logger.info(`Service deleted with ID: ${serviceId}`);

			await this.auditBL.logAction({
				actionType: AuditActionType.DELETE,
				resourceType: AuditResourceType.SERVICE,
				resourceId: String(serviceId),
				userId: user.id,
				userName: user.fullName,
				resourceName: serviceToDelete.name,
			});
		} catch (error) {
			logger.error(`Error deleting service [${serviceId}]`, error);
			throw error;
		}
	}

	async getServiceById(serviceId: number): Promise<Service | null> {
		return await this.serviceRepo.getServiceById(serviceId);
	}
}
