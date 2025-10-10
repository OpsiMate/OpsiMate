import { useQuery } from "@tanstack/react-query";
import { providerApi } from "@/lib/api";
import { queryKeys } from "../queryKeys";

export const useService = (id: number) => {
  return useQuery({
    queryKey: queryKeys.service(id),
    queryFn: async () => {
      const response = await providerApi.getServiceById(id);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch service");
      }
      return response.data;
    },
    enabled: !!id,
  });
};
