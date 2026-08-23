// The analytics computation is a pure function shared with the client's playground
// mode (the demo runs the REAL engine over its mock data), so the implementation
// lives in @OpsiMate/shared. This module keeps the server-local import path stable.
export { computeAlertAnalytics } from '@OpsiMate/shared';
export type { AnalyticsInputs, EpisodeRow, UserEventRow } from '@OpsiMate/shared';
