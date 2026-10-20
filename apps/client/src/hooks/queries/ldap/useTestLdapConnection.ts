import { ldapApi } from '@/lib/api';
import { LdapTestRequest, LdapTestResult } from '@OpsiMate/shared';
import { LdapRequestError } from './LdapRequestError';
import { useMutation } from '@tanstack/react-query';

// Walks the login steps (connect, service account, search base, and optionally one
// user's lookup + role) against the saved settings, or against unsaved edits sent as
// `settings` — nothing is stored either way.
export const useTestLdapConnection = () => {
	return useMutation({
		mutationFn: async (request: LdapTestRequest): Promise<LdapTestResult> => {
			const response = await ldapApi.test(request);
			if (!response.success || !response.data) {
				throw new LdapRequestError(response, 'Failed to run the connection test');
			}
			return response.data;
		},
	});
};
