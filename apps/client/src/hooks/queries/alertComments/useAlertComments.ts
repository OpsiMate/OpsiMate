import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { alertCommentsApi } from './alertComments.api';

export const useAlertComments = (alertId: string | null | undefined) => {
	return useQuery({
		queryKey: [...queryKeys.alertComments, alertId],
		queryFn: async () => {
			if (!alertId) return [];
			const response = await alertCommentsApi.getCommentsByAlertId(alertId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch comments');
			}
			return response.data?.comments || [];
		},
		enabled: !!alertId,
		staleTime: 30 * 1000,
	});
};
