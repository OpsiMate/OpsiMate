import { mutePoliciesApi, MutePolicyPayload } from '@/lib/api';
import { MutePolicy } from '@OpsiMate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useMutePolicies = () => {
	return useQuery({
		queryKey: queryKeys.mutePolicies,
		queryFn: async (): Promise<MutePolicy[]> => {
			const response = await mutePoliciesApi.listMutePolicies();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch mute policies');
			}
			return response.data || [];
		},
		refetchInterval: 30_000,
	});
};

export const useCreateMutePolicy = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (payload: MutePolicyPayload) => {
			const response = await mutePoliciesApi.createMutePolicy(payload);
			if (!response.success) {
				throw new Error(response.error || 'Failed to create mute policy');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.mutePolicies });
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};

export const useUpdateMutePolicy = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, payload }: { id: number; payload: Partial<MutePolicyPayload> }) => {
			const response = await mutePoliciesApi.updateMutePolicy(id, payload);
			if (!response.success) {
				throw new Error(response.error || 'Failed to update mute policy');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.mutePolicies });
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};

export const useDeleteMutePolicy = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: number) => {
			const response = await mutePoliciesApi.deleteMutePolicy(id);
			if (!response.success) {
				throw new Error(response.error || 'Failed to delete mute policy');
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.mutePolicies });
			queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
		},
	});
};
