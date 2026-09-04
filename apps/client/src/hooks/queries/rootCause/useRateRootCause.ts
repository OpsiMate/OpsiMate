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
		onSuccess: (_data, { alertId }) => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.alertRootCause(alertId) });
		},
	});
};
