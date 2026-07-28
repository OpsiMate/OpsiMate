import { silenceResetApi } from '@/lib/api';
import { SilenceResetSettings, UpdateSilenceResetSettings } from '@OpsiMate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useSilenceResetSettings = () => {
	return useQuery({
		queryKey: queryKeys.silenceReset,
		queryFn: async (): Promise<SilenceResetSettings> => {
			const response = await silenceResetApi.getSettings();
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to fetch silence reset settings');
			}
			return response.data;
		},
	});
};

export const useUpdateSilenceResetSettings = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (updates: UpdateSilenceResetSettings) => {
			const response = await silenceResetApi.updateSettings(updates);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to update silence reset settings');
			}
			return response.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.silenceReset }),
	});
};
