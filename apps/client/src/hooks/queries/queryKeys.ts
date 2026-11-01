// The Insights scope as it goes into the alertAnalytics key; absent values are null.
export interface AlertAnalyticsKeyScope {
	filters: Record<string, string[]> | null;
	search: string | null;
	tagKey: string | null;
}

// Query keys for consistent caching across the application
export const queryKeys = {
	alerts: ['alerts'] as const,
	resolvedAlerts: ['resolvedAlerts'] as const,
	// Shared prefix for every alert's comments; useBulkAlertAction invalidates all of them with it.
	alertComments: ['alertComments'] as const,
	alertCommentsFor: (alertId: string | null | undefined) => [...queryKeys.alertComments, alertId] as const,
	// Mutation key: list polling pauses while one is pending (see useAlerts).
	bulkAlertAction: ['bulkAlertAction'] as const,
	// Starts with `alerts`, so invalidating queryKeys.alerts refreshes the Insights page too.
	alertAnalytics: (from: string | null, timeZone: string, scope: AlertAnalyticsKeyScope) =>
		[...queryKeys.alerts, 'analytics', from, timeZone, scope.filters, scope.search, scope.tagKey] as const,
	// Shared prefix for every alert-history query; invalidations target this so a
	// mutation can drop all per-alert histories (see useRunAction, useBulkAlertAction, ...).
	alertHistoryAll: ['alertHistory'] as const,
	alertHistory: (alertId: string) => [...queryKeys.alertHistoryAll, alertId] as const,
	alertRootCause: (alertId: string) => ['alertRootCause', alertId] as const,
	tags: ['tags'] as const,
	integrations: ['integrations'] as const,
	views: ['views'] as const,
	usersExist: ['usersExist'] as const,
	users: ['users'] as const,
	serviceTags: (id: number) => ['serviceTags', id] as const,
	auditLogs: (page: number, pageSize: number) => ['audit', page, pageSize] as const,
	dashboards: ['dashboards'] as const,
	dashboardTags: ['dashboardTags'] as const,
	mutePolicies: ['mutePolicies'] as const,
	oncallTeams: ['oncallTeams'] as const,
	enrichments: ['enrichments'] as const,
	enrichmentHistory: (id: number) => ['enrichments', id, 'history'] as const,
	actions: ['actions'] as const,
	callbacks: ['callbacks'] as const,
	retention: ['retention'] as const,
	silenceReset: ['silenceReset'] as const,
	ai: ['ai'] as const,
	ldap: ['ldap'] as const,
	// Application / server version queries — the shared prefix plus the two concrete keys.
	appVersion: ['appVersion'] as const,
	serverVersion: ['appVersion', 'server'] as const,
	latestRelease: ['appVersion', 'latestRelease'] as const,
};
