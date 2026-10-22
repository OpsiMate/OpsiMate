import { callbacksApi } from '@/lib/api';
import { AlertCallback } from '@OpsiMate/shared';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useCallbacks = () =>
	useQuery({
		queryKey: queryKeys.callbacks,
		queryFn: async (): Promise<AlertCallback[]> => {
			const response = await callbacksApi.listCallbacks();
			if (!response.success) throw new Error(response.error || 'Failed to fetch callbacks');
			return response.data || [];
		},
	});
