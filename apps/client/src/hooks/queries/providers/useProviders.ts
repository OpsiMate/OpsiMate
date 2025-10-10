import { useQuery } from "@tanstack/react-query";
import { providerApi } from "@/lib/api";
import { queryKeys } from "../queryKeys";

export const useProviders = () => {
  return useQuery({
    queryKey: queryKeys.providers,
    queryFn: async () => {
      const response = await providerApi.getProviders();
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch providers");
      }
      return response.data?.providers || [];
    },
  });
};
