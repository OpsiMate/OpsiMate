import { OncallTeamPayload, oncallApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

// CRUD mutations for on-call teams; each one refreshes the teams list on settle.
export const useOncallTeamMutations = () => {
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.oncallTeams });

	const createTeam = useMutation({
		mutationFn: async (payload: OncallTeamPayload) => {
			const response = await oncallApi.createTeam(payload);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to create team');
			}
			return response.data.team;
		},
		onSettled: invalidate,
	});

	const updateTeam = useMutation({
		mutationFn: async ({ teamId, payload }: { teamId: number; payload: Partial<OncallTeamPayload> }) => {
			const response = await oncallApi.updateTeam(teamId, payload);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to update team');
			}
			return response.data.team;
		},
		onSettled: invalidate,
	});

	const deleteTeam = useMutation({
		mutationFn: async (teamId: number) => {
			const response = await oncallApi.deleteTeam(teamId);
			if (!response.success) {
				throw new Error(response.error || 'Failed to delete team');
			}
		},
		onSettled: invalidate,
	});

	const setTeamMembers = useMutation({
		mutationFn: async ({ teamId, userIds }: { teamId: number; userIds: string[] }) => {
			const response = await oncallApi.setTeamMembers(teamId, userIds);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to update team members');
			}
			return response.data.team;
		},
		onSettled: invalidate,
	});

	return { createTeam, updateTeam, deleteTeam, setTeamMembers };
};
