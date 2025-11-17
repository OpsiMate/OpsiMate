import { Request, Response } from 'express';
import {
	CreateServiceSchema,
	ServiceIdSchema,
	UpdateServiceSchema,
	Logger,
	ServiceType,
	Service,
	ServiceWithProvider,
} from '@OpsiMate/shared';
import { ProviderRepository } from '../../../dal/providerRepository';
import { ServiceRepository } from '../../../dal/serviceRepository';
import { ServiceCustomFieldBL } from '../../../bl/custom-fields/serviceCustomField.bl';
import { providerConnectorFactory } from '../../../bl/providers/provider-connector/providerConnectorFactory';
import { ProviderNotFound } from '../../../bl/providers/ProviderNotFound';
import { ServiceNotFound } from '../../../bl/services/ServiceNotFound';
import { checkSystemServiceStatus } from '../../../dal/sshClient';
import { TagRepository } from '../../../dal/tagRepository';
import { AlertBL } from '../../../bl/alerts/alert.bl';
import { isZodError } from '../../../utils/isZodError';
import { ServicesBL } from '../../../bl/services/services.bl';
import { AuthenticatedRequest } from '../../../middleware/auth';

const logger = new Logger('api/v1/services/controller');

export class ServiceController {
	constructor(
		private providerRepo: ProviderRepository,
		private serviceRepo: ServiceRepository,
		private servicesBL: ServicesBL,
		private customFieldBL?: ServiceCustomFieldBL,
		private tagRepo?: TagRepository,
		private alertBL?: AlertBL
	) {}

	private async enrichServicesWithCustomFields(
		services: (Service | ServiceWithProvider)[]
	): Promise<(Service | ServiceWithProvider)[]> {
		if (!this.customFieldBL) {
			return services;
		}

		try {
			// Get custom field values for all services
			const serviceIds = services.map((service) => service.id);
			const customFieldValues: { [serviceId: number]: { [customFieldId: number]: string } } = {};

			for (const serviceId of serviceIds) {
				const values = await this.customFieldBL.getCustomFieldValuesForService(serviceId);
				const customFields: { [customFieldId: number]: string } = {};
				values.forEach((value) => {
					customFields[value.customFieldId] = value.value;
				});
				customFieldValues[serviceId] = customFields;
			}

			// Enrich services with custom fields
			return services.map((service) => ({
				...service,
				customFields: customFieldValues[service.id] || {},
			}));
		} catch (error) {
			logger.error('Error enriching services with custom fields:', error);
			// Return services without custom fields if enrichment fails
			return services.map((service) => ({
				...service,
				customFields: {},
			}));
		}
	}

	createServiceHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const validatedData = CreateServiceSchema.parse(req.body);

			if (!req.user) {
				return res.status(401).json({ success: false, error: 'Unauthorized' });
			}
			const service = await this.servicesBL.createService(validatedData, req.user);

			const provider = await this.providerRepo.getProviderById(validatedData.providerId);

			if (!provider) {
				logger.error(`No provider found with id ${validatedData.providerId}`);
				throw new ProviderNotFound(validatedData.providerId);
			}

			// If it's a systemd service, check its actual status
			if (service.serviceType === ServiceType.SYSTEMD) {
				try {
					const actualStatus = await checkSystemServiceStatus(provider, service.name);
					// Update the service status in the database
					await this.serviceRepo.updateService(service.id, { serviceStatus: actualStatus });
					// Update the service object for the response
					service.serviceStatus = actualStatus;
					logger.info(`Updated systemd service ${service.name} status to ${actualStatus}`);
				} catch (error) {
					logger.error('Failed to check systemd service status:', error);
					// Continue with unknown status if check fails
				}
			}

			const enrichedServices = await this.enrichServicesWithCustomFields([{ ...service, provider }]);
			return res.status(201).json({
				success: true,
				data: enrichedServices[0],
				message: 'Service created successfully',
			});
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else if (error instanceof ProviderNotFound) {
				return res.status(404).json({ success: false, error: `Provider with ID ${error.provider} not found` });
			} else if (error instanceof ServiceNotFound) {
				return res.status(404).json({ success: false, error: `Service with ID ${error.serviceId} not found` });
			} else {
				logger.error('Error creating service:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	getAllServicesHandler = async (_req: Request, res: Response) => {
		try {
			const services = await this.serviceRepo.getServicesWithProvider();
			const enrichedServices = await this.enrichServicesWithCustomFields(services);
			return res.json({ success: true, data: enrichedServices });
		} catch (error) {
			logger.error('Error getting services:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	getServiceByIdHandler = async (req: Request, res: Response) => {
		try {
			const { serviceId } = ServiceIdSchema.parse({ serviceId: req.params.serviceId });
			const service = await this.serviceRepo.getServiceWithProvider(serviceId);
			if (!service) {
				return res.status(404).json({ success: false, error: 'Service not found' });
			}

			const enrichedServices = await this.enrichServicesWithCustomFields([service]);
			return res.json({ success: true, data: enrichedServices[0] });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error getting service:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	updateServiceHandler = async (req: Request, res: Response) => {
		try {
			const { serviceId } = ServiceIdSchema.parse({ serviceId: req.params.serviceId });
			const validatedData = UpdateServiceSchema.partial().parse(req.body);
			const service = await this.serviceRepo.getServiceById(serviceId);

			if (!service) {
				return res.status(404).json({ success: false, error: 'Service not found' });
			}

			await this.serviceRepo.updateService(serviceId, validatedData);
			const updatedService = await this.serviceRepo.getServiceWithProvider(serviceId);

			if (updatedService) {
				const enrichedServices = await this.enrichServicesWithCustomFields([updatedService]);
				return res.json({ success: true, data: enrichedServices[0], message: 'Service updated successfully' });
			} else {
				return res.json({ success: true, data: null, message: 'Service updated successfully' });
			}
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error updating service:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	deleteServiceHandler = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const { serviceId } = ServiceIdSchema.parse({ serviceId: req.params.serviceId });

			if (!req.user) {
				return res.status(401).json({ success: false, error: 'Unauthorized' });
			}

			if (this.customFieldBL) {
				try {
					const deletedValuesCount = await this.customFieldBL.deleteAllValuesForService(serviceId);
					logger.info(`Deleted ${deletedValuesCount} custom field values for service ${serviceId}`);
				} catch (error) {
					logger.warn(
						`Failed to delete custom field values for service ${serviceId}: ${error instanceof Error ? error.message : String(error)}`
					);
				}
			}
			await this.tagRepo?.deleteAllServiceTags(serviceId);

			await this.servicesBL.deleteService(serviceId, req.user);

			res.json({ success: true, message: 'Service deleted successfully' });
		} catch (error) {
			if (isZodError(error)) {
				res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else if (error instanceof ServiceNotFound) {
				res.status(404).json({ success: false, error: `Service with ID ${error.serviceId} not found` });
			} else {
				logger.error('Error deleting service:', error);
				res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	startServiceHandler = async (req: Request, res: Response) => {
		try {
			const { serviceId } = ServiceIdSchema.parse({ serviceId: req.params.serviceId });
			const service = await this.serviceRepo.getServiceWithProvider(serviceId);

			if (!service) {
				return res.status(404).json({ success: false, error: 'Service not found' });
			}

			const provider = await this.providerRepo.getProviderById(service.providerId);
			if (!provider) {
				return res.status(404).json({ success: false, error: 'Provider not found for this service' });
			}

			const providerConnector = providerConnectorFactory(provider.providerType);
			await providerConnector.startService(provider, service);
			await this.serviceRepo.updateService(serviceId, { serviceStatus: 'running' });

			const updatedService = await this.serviceRepo.getServiceWithProvider(serviceId);
			if (updatedService) {
				const enrichedServices = await this.enrichServicesWithCustomFields([updatedService]);
				return res.json({ success: true, data: enrichedServices[0], message: 'Service started successfully' });
			} else {
				return res.json({ success: true, data: null, message: 'Service started successfully' });
			}
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error starting service:', error);
				const message = error instanceof Error ? error.message : String(error);
				return res.status(500).json({ success: false, error: 'Internal server error', details: message });
			}
		}
	};

	stopServiceHandler = async (req: Request, res: Response) => {
		try {
			const { serviceId } = ServiceIdSchema.parse({ serviceId: req.params.serviceId });
			const service = await this.serviceRepo.getServiceById(serviceId);

			if (!service) {
				return res.status(404).json({ success: false, error: 'Service not found' });
			}

			const provider = await this.providerRepo.getProviderById(service.providerId);
			if (!provider) {
				return res.status(404).json({ success: false, error: 'Provider not found for this service' });
			}

			const providerConnector = providerConnectorFactory(provider.providerType);
			await providerConnector.stopService(provider, service);
			await this.serviceRepo.updateService(serviceId, { serviceStatus: 'stopped' });

			const updatedService = await this.serviceRepo.getServiceWithProvider(serviceId);
			if (updatedService) {
				const enrichedServices = await this.enrichServicesWithCustomFields([updatedService]);
				return res.json({ success: true, data: enrichedServices[0], message: 'Service stopped successfully' });
			} else {
				return res.json({ success: true, data: null, message: 'Service stopped successfully' });
			}
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error stopping service:', error);
				const message = error instanceof Error ? error.message : String(error);
				return res.status(500).json({ success: false, error: 'Internal server error', details: message });
			}
		}
	};

	getServiceLogsHandler = async (req: Request, res: Response) => {
		try {
			const { serviceId } = ServiceIdSchema.parse({ serviceId: req.params.serviceId });
			const service = await this.serviceRepo.getServiceById(serviceId);

			if (!service) {
				return res.status(404).json({ success: false, error: 'Service not found' });
			}

			const provider = await this.providerRepo.getProviderById(service.providerId);
			if (!provider) {
				return res.status(404).json({ success: false, error: 'Provider not found for this service' });
			}

			const providerConnector = providerConnectorFactory(provider.providerType);
			const logs = await providerConnector.getServiceLogs(provider, service);

			return res.json({ success: true, data: logs, message: 'Service logs retrieved successfully' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error getting logs:', error);
				const message = error instanceof Error ? error.message : String(error);
				return res.status(500).json({ success: false, error: 'Internal server error', details: message });
			}
		}
	};

	getServicePodsHandler = async (req: Request, res: Response) => {
		try {
			const { serviceId } = ServiceIdSchema.parse({ serviceId: req.params.serviceId });
			const service = await this.serviceRepo.getServiceById(serviceId);

			if (!service) {
				return res.status(404).json({ success: false, error: 'Service not found' });
			}

			const provider = await this.providerRepo.getProviderById(service.providerId);
			if (!provider) {
				return res.status(404).json({ success: false, error: 'Provider not found for this service' });
			}

			const providerConnector = providerConnectorFactory(provider.providerType);
			const pods = await providerConnector.getServicePods(provider, service);

			return res.json({ success: true, data: pods, message: 'Service pods retrieved successfully' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error getting pods:', error);
				const message = error instanceof Error ? error.message : String(error);
				return res.status(500).json({ success: false, error: 'Internal server error', details: message });
			}
		}
	};
}
