import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useAuditLogs = (page = 1, pageSize = 20) => {
  return useQuery({
    queryKey: queryKeys.auditLogs(page, pageSize),
    queryFn: async () => {
      const response = await auditApi.getAuditLogs(page, pageSize);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch audit logs');
      }
      return response.data || { logs: [], total: 0 };
    },
  });
};
