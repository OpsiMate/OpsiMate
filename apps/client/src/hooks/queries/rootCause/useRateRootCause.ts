import { RootCauseRating } from '@OpsiMate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { rootCauseApi } from './rootCause.api';

interface RateRootCauseInput {
	alertId: string;
	rating: RootCauseRating;
}

export const useRateRootCause = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ alertId, rating }: RateRootCauseInput) => {
			const response = await rootCauseApi.rate(alertId, rating);
			if (!response.success) {
				throw new Error(response.error || 'Failed to rate root cause');
			}
			return response.data;
		},
		// Returning the promise keeps isPending true until the refetched rating is in
		// the cache — the buttons re-enable only once they reflect the stored verdict.
		onSuccess: (_data, { alertId }) =>
			queryClient.invalidateQueries({ queryKey: queryKeys.alertRootCause(alertId) }),
	});
};
