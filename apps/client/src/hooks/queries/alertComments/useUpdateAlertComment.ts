import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { alertCommentsApi } from './alertComments.api';

interface UpdateCommentParams {
	commentId: string;
	comment: string;
	alertId: string;
}

export const useUpdateAlertComment = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ commentId, comment }: UpdateCommentParams) => {
			const response = await alertCommentsApi.updateComment(commentId, comment);
			if (!response.success) {
				throw new Error(response.error || 'Failed to update comment');
			}
			return response.data?.comment;
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: [...queryKeys.alertComments, variables.alertId] });
		},
	});
};
