import { ldapApi } from '@/lib/api';
import { LdapSettings } from '@OpsiMate/shared';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

export const useLdapSettings = () => {
	return useQuery({
		queryKey: queryKeys.ldap,
		queryFn: async (): Promise<LdapSettings> => {
			const response = await ldapApi.getSettings();
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to fetch LDAP settings');
			}
			return response.data;
		},
	});
};
