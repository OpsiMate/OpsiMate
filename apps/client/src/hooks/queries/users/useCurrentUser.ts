import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { User } from '@OpsiMate/shared';
import { getCurrentUser } from '@/lib/auth';

/**
 * Hook to fetch the current user's full profile from the server.
 * This includes avatarUrl which is not available in the JWT token.
 */
export const useCurrentUser = () => {
	const jwtUser = getCurrentUser();

	return useQuery({
		queryKey: ['current-user-profile'],
		queryFn: async () => {
			const response = await apiRequest<User>('/users/profile', 'GET');
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to fetch user profile');
			}
			return response.data;
		},
		enabled: !!jwtUser, // Only fetch if user is logged in
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
};
