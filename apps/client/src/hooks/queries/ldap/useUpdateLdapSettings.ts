import { ldapApi } from '@/lib/api';
import { LdapSettings, UpdateLdapSettings } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useUpdateLdapSettings = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (updates: UpdateLdapSettings): Promise<LdapSettings> => {
			const response = await ldapApi.updateSettings(updates);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to update LDAP settings');
			}
			return response.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ldap }),
	});
};
