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

	// `comment` rides along only with a thumbs-down ("what went wrong?"); the server
	// ignores it on thumbs-up, so the client never sends one there.
	rate: async (
		alertId: string,
		rating: RootCauseRating,
		comment?: string
	): Promise<ApiResponse<RateRootCauseResult>> => {
		return apiRequest<RateRootCauseResult>(
			`/alerts/${encodeURIComponent(alertId)}/root-cause/rating`,
			'POST',
			comment ? { rating, comment } : { rating }
		);
	},
};
