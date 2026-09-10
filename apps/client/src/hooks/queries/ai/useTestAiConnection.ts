import { aiApi } from '@/lib/api';
import { AiTestResult } from '@OpsiMate/shared';
import { useMutation } from '@tanstack/react-query';

// Fires one real (tiny) Bedrock call with the SAVED configuration and returns the
// outcome — save first, then test, so what was verified is what is stored.
export const useTestAiConnection = () => {
	return useMutation({
		mutationFn: async (): Promise<AiTestResult> => {
			const response = await aiApi.testConnection();
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to run the connection test');
			}
			return response.data;
		},
	});
};
