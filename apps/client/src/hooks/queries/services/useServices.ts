import { useQuery } from '@tanstack/react-query';
import { providerApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useServices = () => {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: async () => {
      const response = await providerApi.getAllServices();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch services');
      }
      
      // Transform the data to match the Service interface
      const transformedServices = (response.data || []).map((service: any) => ({
        id: service.id.toString(), // Convert number to string
        name: service.name,
        serviceIP: service.serviceIP,
        serviceStatus: service.serviceStatus,
        serviceType: service.serviceType,
        createdAt: service.createdAt,
        provider: service.provider,
        containerDetails: service.containerDetails,
        tags: service.tags || [],
        customFields: service.customFields || {}
      }));
      
      return transformedServices;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}; 