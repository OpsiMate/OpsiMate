import { viewsApi } from '@/lib/api';
import { Logger } from '@OpsiMate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

const logger = new Logger('useActiveView');

const ACTIVE_VIEW_STORAGE_KEY = 'OpsiMate-active-view-id';

export const useActiveView = () => {
	const queryClient = useQueryClient();

	const {
		data: activeViewId,
		isLoading,
		error,
	} = useQuery({
		queryKey: [...queryKeys.views, 'active'],
		queryFn: async () => {
			try {
				const response = await viewsApi.getActiveViewId();

				if (response.success && response.data) {
					return response.data.activeViewId || 'default-view';
				}

				// If API returns error (like 404 when no active view is set), handle gracefully
				if (response.error && response.error.includes('404')) {
					// No active view is set on server, this is expected - check localStorage or return default
					const localStorageViewId = localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
					return localStorageViewId || 'default-view';
				}

				// For other API errors, fall back to localStorage
				logger.warn('API get active view failed, falling back to localStorage', response.error);
				const localStorageViewId = localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);

				// If no active view is set, return the default view ID
				return localStorageViewId || 'default-view';
			} catch (error) {
				logger.error('Failed to get active view ID:', error);
				// Return default view ID as fallback
				return 'default-view';
			}
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	const setActiveViewMutation = useMutation({
		mutationFn: async (viewId: string | undefined) => {
			if (viewId) {
				const response = await viewsApi.setActiveView(viewId);

				if (!response.success) {
					logger.warn('API set active view failed, falling back to localStorage', response.error);
					// Fall back to localStorage
					localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, viewId);
				}
			} else {
				// For now, just remove from localStorage as the API doesn't have a clear endpoint
				localStorage.removeItem(ACTIVE_VIEW_STORAGE_KEY);
			}
		},
		onSuccess: (_, viewId) => {
			// Update the query cache with the new active view ID
			queryClient.setQueryData([...queryKeys.views, 'active'], viewId || 'default-view');
		},
	});

	return {
		activeViewId,
		isLoading,
		error,
		setActiveView: setActiveViewMutation.mutateAsync,
		isSettingActiveView: setActiveViewMutation.isPending,
	};
};
