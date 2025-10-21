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
      const transformedServices = (response.data || []).map(
        (service: {
          id: number;
          name: string;
          serviceIP: string;
          serviceStatus: string;
          serviceType: string;
          provider: { id: number; name: string; providerType: string };
          tags: string[];
        }) => ({
          id: service.id.toString(), // Convert number to string
          name: service.name,
          serviceIP: service.serviceIP,
          serviceStatus: service.serviceStatus,
          serviceType: service.serviceType,
          createdAt: service.createdAt,
          provider: service.provider,
          containerDetails: service.containerDetails,
          tags: service.tags || [],
          customFields: service.customFields || {},
        })
      );

      return transformedServices;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};
