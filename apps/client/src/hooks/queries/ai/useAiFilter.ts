import { aiApi } from '@/lib/api';
import { useMutation } from '@tanstack/react-query';

// Natural language -> the dashboard's filter record, validated server-side against the
// live facet vocabulary.
export const useAiFilter = () => {
	return useMutation({
		mutationFn: async (query: string) => {
			const response = await aiApi.filterFromText(query);
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to translate the request');
			}
			return response.data;
		},
	});
};
