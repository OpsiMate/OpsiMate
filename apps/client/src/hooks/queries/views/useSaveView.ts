import { useMutation, useQueryClient } from "@tanstack/react-query";
import { viewsApi } from "@/lib/api";
import { queryKeys } from "../queryKeys";
import { SavedView } from "@/types/SavedView";

export const useSaveView = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (view: SavedView) => {
      const response = await viewsApi.saveView(view);
      if (!response.success) {
        throw new Error(response.error || "Failed to save view");
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch views
      queryClient.invalidateQueries({ queryKey: queryKeys.views });
    },
  });
};
