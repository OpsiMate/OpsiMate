import { AlertCallbackTestInput, callbacksApi } from '@/lib/api';
import { AlertCallbackTestResult } from '@OpsiMate/shared';
import { useMutation } from '@tanstack/react-query';

// Sends one sample request with the form's current values, saved or not.
export const useTestCallback = () =>
	useMutation({
		mutationFn: async (payload: AlertCallbackTestInput): Promise<AlertCallbackTestResult> => {
			const response = await callbacksApi.testCallback(payload);
			if (!response.success || !response.data) throw new Error(response.error || 'Failed to test callback');
			return response.data;
		},
	});
