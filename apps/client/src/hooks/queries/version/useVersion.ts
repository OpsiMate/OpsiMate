import { useQuery } from '@tanstack/react-query';
import { versionApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useVersion = () => {
  return useQuery({
    queryKey: queryKeys.version,
    queryFn: async () => {
      const response = await versionApi.getVersion();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch version');
      }
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

