import { useMutation, useQueryClient } from '@tanstack/react-query';
import { viewsApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useDeleteView = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (viewId: string) => {
			const response = await viewsApi.deleteView(viewId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to delete view');
			}
			return response.data;
		},
		onSuccess: () => {
			// Invalidate and refetch views
			queryClient.invalidateQueries({ queryKey: queryKeys.views });
		},
	});
};
