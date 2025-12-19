import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export interface UserInfo {
	id: string;
	email: string;
	fullName: string;
	role: string;
}

export const useUsers = () => {
	return useQuery({
		queryKey: queryKeys.users,
		queryFn: async () => {
			const response = await usersApi.getAllUsers();
			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch users');
			}
			return response.data || [];
		},
	});
};
