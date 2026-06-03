import { actionsApi, ActionPayload } from '@/lib/api';
import { Action, ActionOverrides, Alert } from '@OpsiMate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useActions = () => {
	return useQuery({
		queryKey: queryKeys.actions,
		queryFn: async (): Promise<Action[]> => {
			const response = await actionsApi.listActions();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch actions');
			}
			return response.data || [];
		},
	});
};

export const useCreateAction = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (payload: ActionPayload) => {
			const response = await actionsApi.createAction(payload);
			if (!response.success) {
				throw new Error(response.error || 'Failed to create action');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.actions });
		},
	});
};

export const useUpdateAction = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, payload }: { id: number; payload: ActionPayload }) => {
			const response = await actionsApi.updateAction(id, payload);
			if (!response.success) {
				throw new Error(response.error || 'Failed to update action');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.actions });
		},
	});
};

export const useTestAction = () => {
	return useMutation({
		mutationFn: async (payload: ActionPayload) => {
			const response = await actionsApi.testAction(payload);
			if (!response.success) {
				throw new Error(response.error || 'Failed to test action');
			}
			return response.data;
		},
	});
};

export const usePreviewAction = () => {
	return useMutation({
		mutationFn: async ({ id, alert }: { id: number; alert: Alert }) => {
			const response = await actionsApi.previewAction(id, alert);
			if (!response.success) {
				throw new Error(response.error || 'Failed to preview action');
			}
			return response.data;
		},
	});
};

export const useRunAction = () => {
	return useMutation({
		mutationFn: async ({
			id,
			alert,
			overrides,
		}: {
			id: number;
			alert: Alert;
			overrides?: ActionOverrides;
		}) => {
			const response = await actionsApi.runAction(id, alert, overrides);
			if (!response.success) {
				throw new Error(response.error || 'Failed to run action');
			}
			return response.data;
		},
	});
};

export const useDeleteAction = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: number) => {
			const response = await actionsApi.deleteAction(id);
			if (!response.success) {
				throw new Error(response.error || 'Failed to delete action');
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.actions });
		},
	});
};
