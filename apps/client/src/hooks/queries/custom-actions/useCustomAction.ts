import { useQuery } from '@tanstack/react-query';
import { customActionsApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useCustomAction = (actionId: number) => {
	return useQuery({
		queryKey: queryKeys.customAction(actionId),
		queryFn: async () => {
			const response = await customActionsApi.getActionById(actionId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch custom action');
			}
			return response.data;
		},
		enabled: !!actionId,
	});
};
