import { API_BASE_URL, ApiResponse } from '@/lib/api';
import { AlertComment } from '@OpsiMate/shared';

const getAuthHeaders = () => {
	const token = localStorage.getItem('jwt');
	return {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};
};

export const alertCommentsApi = {
	getCommentsByAlertId: async (alertId: string): Promise<ApiResponse<{ comments: AlertComment[] }>> => {
		const response = await fetch(`${API_BASE_URL}/alerts/${alertId}/comments`, {
			method: 'GET',
			headers: getAuthHeaders(),
			credentials: 'include',
		});
		return response.json();
	},

	createComment: async (
		alertId: string,
		userId: string,
		comment: string
	): Promise<ApiResponse<{ comment: AlertComment }>> => {
		const response = await fetch(`${API_BASE_URL}/alerts/${alertId}/comments`, {
			method: 'POST',
			headers: getAuthHeaders(),
			credentials: 'include',
			body: JSON.stringify({ userId, comment }),
		});
		return response.json();
	},

	updateComment: async (commentId: string, comment: string): Promise<ApiResponse<{ comment: AlertComment }>> => {
		const response = await fetch(`${API_BASE_URL}/alerts/comments/${commentId}`, {
			method: 'PATCH',
			headers: getAuthHeaders(),
			credentials: 'include',
			body: JSON.stringify({ comment }),
		});
		return response.json();
	},

	deleteComment: async (commentId: string): Promise<ApiResponse<{ message: string }>> => {
		const response = await fetch(`${API_BASE_URL}/alerts/comments/${commentId}`, {
			method: 'DELETE',
			headers: getAuthHeaders(),
			credentials: 'include',
		});
		return response.json();
	},
};
