import { Provider, CreateProviderSchema } from '@service-peek/shared';
import { ProviderRepository, CreateProviderData } from '../dal/provider-repository';
import { SSHService } from './ssh-service';
import { z } from 'zod';

export class ProviderService {
    static async createProvider(data: unknown): Promise<Provider> {
        // Validate input
        const validatedData = CreateProviderSchema.parse(data);
        
        // Create provider in database
        return await ProviderRepository.create(validatedData);
    }

    static async getProviderById(id: number): Promise<Provider | null> {
        if (isNaN(id)) {
            throw new Error('Invalid provider ID');
        }
        
        return await ProviderRepository.findById(id);
    }

    static async getAllProviders(): Promise<Provider[]> {
        return await ProviderRepository.findAll();
    }

    static async getProviderWithContainers(providerId: number) {
        const provider = await this.getProviderById(providerId);
        
        if (!provider) {
            throw new Error('Provider not found');
        }

        const containers = await SSHService.getDockerContainers(provider);
        
        return {
            provider,
            containers
        };
    }
}