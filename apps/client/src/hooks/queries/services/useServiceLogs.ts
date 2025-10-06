import { useQuery } from '@tanstack/react-query';
import { providerApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';
import { LogEntry } from '@OpsiMate/shared';

export const useServiceLogs = (
  id: number, 
  filters?: {
    levels?: string[];
    searchText?: string;
    since?: string;
    until?: string;
    limit?: number;
    source?: string;
  },
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) => {
  return useQuery({
    queryKey: queryKeys.serviceLogs(id, filters),
    queryFn: async () => {
      const response = await providerApi.getServiceLogs(id, filters);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch service logs');
      }
      return (response.data || []) as LogEntry[];
    },
    enabled: options?.enabled !== false && !!id,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: options?.refetchInterval || 10 * 1000, // Auto-refresh every 10 seconds
  });
}; 