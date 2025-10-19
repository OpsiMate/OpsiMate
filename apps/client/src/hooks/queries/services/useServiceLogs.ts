import { useQuery } from '@tanstack/react-query';
import { providerApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

interface LogFetchOptions {
  rowLimit?: number;
  sizeLimitMB?: number;
  includeErrors?: boolean;
}

export const useServiceLogs = (id: number, options?: LogFetchOptions) => {
  return useQuery({
    queryKey: [queryKeys.serviceLogs(id), options],
    queryFn: async () => {
      const response = await providerApi.getServiceLogs(id, options);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch service logs');
      }
      return response.data || [];
    },
    enabled: !!id,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 10 * 1000, // Auto-refresh every 10 seconds
  });
}; 