import { BulkServiceSchema } from '@service-peek/shared';
import { ServiceRepository, Service } from '../dal/service-repository';
import { ProviderRepository } from '../dal/provider-repository';
import { z } from 'zod';

export class ServiceService {
    static async bulkCreateServices(providerId: number, data: unknown): Promise<Service[]> {
        if (isNaN(providerId)) {
            throw new Error('Invalid provider ID');
        }

        // Validate input
        const validatedData = BulkServiceSchema.parse(data);

        // Check if provider exists
        const provider = await ProviderRepository.findById(providerId);
        if (!provider) {
            throw new Error('Provider not found');
        }

        // Store services in database
        const storedServices: Service[] = [];

        for (const serviceName of validatedData.service_names) {
            const service = await ServiceRepository.create({
                provider_id: providerId,
                service_name: serviceName,
                service_ip: provider.provider_ip
            });
            storedServices.push(service);
        }

        return storedServices;
    }

    static async getServicesByProviderId(providerId: number): Promise<Service[]> {
        if (isNaN(providerId)) {
            throw new Error('Invalid provider ID');
        }

        return await ServiceRepository.findByProviderId(providerId);
    }
}