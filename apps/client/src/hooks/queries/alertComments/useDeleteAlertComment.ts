import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { alertCommentsApi } from './alertComments.api';

interface DeleteCommentParams {
	commentId: string;
	alertId: string;
}

export const useDeleteAlertComment = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ commentId }: DeleteCommentParams) => {
			const response = await alertCommentsApi.deleteComment(commentId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to delete comment');
			}
			return response.data;
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: [...queryKeys.alertComments, variables.alertId] });
		},
	});
};
