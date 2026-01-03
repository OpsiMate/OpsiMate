import { ApiResponse, apiRequest } from '@/lib/api';
import { AlertComment } from '@OpsiMate/shared';

export const alertCommentsApi = {
	getCommentsByAlertId: async (alertId: string): Promise<ApiResponse<{ comments: AlertComment[] }>> => {
		return apiRequest<{ comments: AlertComment[] }>(`/alerts/${alertId}/comments`, 'GET');
	},

	createComment: async (
		alertId: string,
		userId: string,
		comment: string
	): Promise<ApiResponse<{ comment: AlertComment }>> => {
		return apiRequest<{ comment: AlertComment }>(`/alerts/${alertId}/comments`, 'POST', { userId, comment });
	},

	updateComment: async (commentId: string, comment: string): Promise<ApiResponse<{ comment: AlertComment }>> => {
		return apiRequest<{ comment: AlertComment }>(`/alerts/comments/${commentId}`, 'PATCH', { comment });
	},

	deleteComment: async (commentId: string): Promise<ApiResponse<{ message: string }>> => {
		return apiRequest<{ message: string }>(`/alerts/comments/${commentId}`, 'DELETE');
	},
};
