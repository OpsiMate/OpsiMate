import { useQuery } from "@tanstack/react-query";
import { providerApi } from "@/lib/api";
import { queryKeys } from "../queryKeys";

export const useProvider = (id: number) => {
  return useQuery({
    queryKey: queryKeys.provider(id),
    queryFn: async () => {
      const response = await providerApi.getProvider(id);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch provider");
      }
      return response.data;
    },
    enabled: !!id,
  });
};
