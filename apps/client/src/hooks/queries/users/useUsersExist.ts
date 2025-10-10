import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "../queryKeys";

export const useUsersExist = () => {
  return useQuery({
    queryKey: queryKeys.usersExist,
    queryFn: async () => {
      const response = await apiRequest<{ exists: boolean }>(
        "/users/exists",
        "GET",
      );
      if (!response || !response.success) {
        throw new Error(response?.error || "Failed to check if users exist");
      }
      return response?.exists || false;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
