import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { alertCommentsApi } from './alertComments.api';

interface CreateCommentParams {
	alertId: string;
	userId: string;
	comment: string;
}

export const useCreateAlertComment = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ alertId, userId, comment }: CreateCommentParams) => {
			const response = await alertCommentsApi.createComment(alertId, userId, comment);
			if (!response.success) {
				throw new Error(response.error || 'Failed to create comment');
			}
			return response.data?.comment;
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: [...queryKeys.alertComments, variables.alertId] });
		},
	});
};
