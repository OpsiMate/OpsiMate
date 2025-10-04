import { Service, Logger, User } from '@OpsiMate/shared';
import { ServiceRepository } from '../../dal/serviceRepository';
import { AuditBL } from '../audit/audit.bl';
import { AuditActionType, AuditResourceType } from '@OpsiMate/shared';
import { ServiceNotFound } from './ServiceNotFound'; // <-- Added a new import

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

            // This is our safety check
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
}