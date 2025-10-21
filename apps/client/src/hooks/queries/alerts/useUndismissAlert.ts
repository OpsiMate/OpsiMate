import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useUndismissAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const response = await alertsApi.undismissAlert(alertId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to undismiss alert');
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch alerts
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
    },
  });
};
