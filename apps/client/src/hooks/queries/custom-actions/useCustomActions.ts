import { useQuery } from '@tanstack/react-query';
import { customActionsApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';
import { CustomAction } from '@OpsiMate/custom-actions';

type CustomActionWithId = CustomAction & { id: number };

export const useCustomActions = () => {
	return useQuery({
		queryKey: queryKeys.customActions,
		queryFn: async () => {
			const response = await customActionsApi.getActions();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch custom actions');
			}
			const actions = (response.data?.actions || []) as CustomActionWithId[];
			const actionsWithId = actions.filter((action) => {
				if (!action.id) {
					console.warn('Action missing id:', action);
					return false;
				}
				return true;
			});
			return actionsWithId;
		},
	});
};
