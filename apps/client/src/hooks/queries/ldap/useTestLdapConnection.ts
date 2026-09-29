import { ldapApi } from '@/lib/api';
import { LdapTestRequest, LdapTestResult } from '@OpsiMate/shared';
import { useMutation } from '@tanstack/react-query';

// Walks the login steps against the SAVED settings (connect, service account, search
// base, and optionally one user's lookup + role) — save first, then test.
export const useTestLdapConnection = () => {
	return useMutation({
		mutationFn: async (request: LdapTestRequest): Promise<LdapTestResult> => {
			const response = await ldapApi.test(request);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to run the connection test');
			}
			return response.data;
		},
	});
};
