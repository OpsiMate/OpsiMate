import { enrichmentsApi, EnrichmentPayload } from '@/lib/api';
import { AlertEnrichment } from '@OpsiMate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useEnrichments = () => {
	return useQuery({
		queryKey: queryKeys.enrichments,
		queryFn: async (): Promise<AlertEnrichment[]> => {
			const response = await enrichmentsApi.listEnrichments();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch enrichments');
			}
			return response.data || [];
		},
	});
};

export const useCreateEnrichment = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (payload: EnrichmentPayload) => {
			const response = await enrichmentsApi.createEnrichment(payload);
			if (!response.success) {
				throw new Error(response.error || 'Failed to create enrichment');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.enrichments });
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};

export const useUpdateEnrichment = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, payload }: { id: number; payload: Partial<EnrichmentPayload> }) => {
			const response = await enrichmentsApi.updateEnrichment(id, payload);
			if (!response.success) {
				throw new Error(response.error || 'Failed to update enrichment');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.enrichments });
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};

export const useDeleteEnrichment = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: number) => {
			const response = await enrichmentsApi.deleteEnrichment(id);
			if (!response.success) {
				throw new Error(response.error || 'Failed to delete enrichment');
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.enrichments });
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};
