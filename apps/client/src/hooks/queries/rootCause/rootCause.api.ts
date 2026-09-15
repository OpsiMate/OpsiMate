import { ApiResponse, apiRequest } from '@/lib/api';
import { AlertRootCause, RateRootCauseResult, RootCauseRating } from '@OpsiMate/shared';

// The PUT (upsert) endpoint is machine-facing — external systems push analyses with
// the API token — so the client only ever reads and rates.
export const rootCauseApi = {
	getByAlertId: async (alertId: string): Promise<ApiResponse<{ rootCause: AlertRootCause | null }>> => {
		return apiRequest<{ rootCause: AlertRootCause | null }>(
			`/alerts/${encodeURIComponent(alertId)}/root-cause`,
			'GET'
		);
	},

	rate: async (alertId: string, rating: RootCauseRating): Promise<ApiResponse<RateRootCauseResult>> => {
		return apiRequest<RateRootCauseResult>(`/alerts/${encodeURIComponent(alertId)}/root-cause/rating`, 'POST', {
			rating,
		});
	},
};
