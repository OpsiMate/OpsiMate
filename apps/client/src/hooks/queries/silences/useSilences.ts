import { silencesApi, SilencePayload } from '@/lib/api';
import { AlertSilence } from '@OpsiMate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useSilences = () => {
	return useQuery({
		queryKey: queryKeys.silences,
		queryFn: async (): Promise<AlertSilence[]> => {
			const response = await silencesApi.listSilences();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch silences');
			}
			return response.data || [];
		},
		refetchInterval: 30_000,
	});
};

export const useCreateSilence = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (payload: SilencePayload) => {
			const response = await silencesApi.createSilence(payload);
			if (!response.success) {
				throw new Error(response.error || 'Failed to create silence');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.silences });
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};

export const useUpdateSilence = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, payload }: { id: number; payload: Partial<SilencePayload> }) => {
			const response = await silencesApi.updateSilence(id, payload);
			if (!response.success) {
				throw new Error(response.error || 'Failed to update silence');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.silences });
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};

export const useDeleteSilence = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: number) => {
			const response = await silencesApi.deleteSilence(id);
			if (!response.success) {
				throw new Error(response.error || 'Failed to delete silence');
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.silences });
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};
