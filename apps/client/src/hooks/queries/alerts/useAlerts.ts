import { useQuery } from "@tanstack/react-query";
import { alertsApi } from "@/lib/api";
import { queryKeys } from "../queryKeys";

export const useAlerts = () => {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: async () => {
      const response = await alertsApi.getAllAlerts();
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch alerts");
      }
      return response.data?.alerts || [];
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
};
