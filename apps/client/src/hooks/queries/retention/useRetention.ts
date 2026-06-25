import { retentionApi } from '@/lib/api';
import { RetentionResource, RetentionSettings } from '@OpsiMate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useRetentionSettings = () => {
	return useQuery({
		queryKey: queryKeys.retention,
		queryFn: async (): Promise<RetentionSettings> => {
			const response = await retentionApi.getSettings();
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to fetch retention settings');
			}
			return response.data;
		},
	});
};

export const useUpdateRetentionConfig = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (cleanupIntervalHours: number) => {
			const response = await retentionApi.updateConfig(cleanupIntervalHours);
			if (!response.success) throw new Error(response.error || 'Failed to update retention config');
			return response.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.retention }),
	});
};

export const useUpdateRetentionPolicy = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			resourceType,
			updates,
		}: {
			resourceType: RetentionResource;
			updates: { enabled?: boolean; retentionDays?: number };
		}) => {
			const response = await retentionApi.updatePolicy(resourceType, updates);
			if (!response.success) throw new Error(response.error || 'Failed to update retention policy');
			return response.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.retention }),
	});
};

export const useRunRetention = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const response = await retentionApi.runNow();
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to run retention cleanup');
			}
			return response.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.retention }),
	});
};
