import { HttpMethod } from './registry';

// Routes that exist but aren't in the API reference yet. apiDocsCoverage.test.ts fails for
// any route that is neither documented (routes/*.ts) nor listed here, so new endpoints
// can't go undocumented by accident. Document a group, then delete its lines here — the
// test also fails if a listed route gets documented or stops existing.

export interface PendingRoute {
	method: HttpMethod;
	path: string;
}

export const PENDING_API_ROUTES: PendingRoute[] = [
	// users
	{ method: 'post', path: '/api/v1/users/forgot-password' },
	{ method: 'post', path: '/api/v1/users/validate-reset-password-token' },
	{ method: 'post', path: '/api/v1/users/reset-password' },
	{ method: 'post', path: '/api/v1/users' },
	{ method: 'get', path: '/api/v1/users' },
	{ method: 'patch', path: '/api/v1/users/role' },
	{ method: 'get', path: '/api/v1/users/profile' },
	{ method: 'patch', path: '/api/v1/users/profile' },
	{ method: 'delete', path: '/api/v1/users/:id' },
	{ method: 'patch', path: '/api/v1/users/:id/reset-password' },
	{ method: 'patch', path: '/api/v1/users/:id' },
	// playground
	{ method: 'post', path: '/api/v1/playground/book-demo' },
	// dashboards
	{ method: 'get', path: '/api/v1/dashboards' },
	{ method: 'post', path: '/api/v1/dashboards' },
	{ method: 'put', path: '/api/v1/dashboards/:dashboardId' },
	{ method: 'delete', path: '/api/v1/dashboards/:dashboardId' },
	{ method: 'get', path: '/api/v1/dashboards/tags' },
	{ method: 'get', path: '/api/v1/dashboards/:dashboardId/tags' },
	{ method: 'post', path: '/api/v1/dashboards/:dashboardId/tags' },
	{ method: 'delete', path: '/api/v1/dashboards/:dashboardId/tags/:tagId' },
	// tags
	{ method: 'get', path: '/api/v1/tags' },
	{ method: 'post', path: '/api/v1/tags' },
	{ method: 'get', path: '/api/v1/tags/:tagId' },
	{ method: 'put', path: '/api/v1/tags/:tagId' },
	{ method: 'delete', path: '/api/v1/tags/:tagId' },
	// alerts
	{ method: 'get', path: '/api/v1/alerts/facets' },
	{ method: 'get', path: '/api/v1/alerts/analytics' },
	{ method: 'get', path: '/api/v1/alerts/groups' },
	{ method: 'post', path: '/api/v1/alerts/bulk' },
	{ method: 'get', path: '/api/v1/alerts/silence-reset' },
	{ method: 'put', path: '/api/v1/alerts/silence-reset' },
	{ method: 'get', path: '/api/v1/alerts/resolved/facets' },
	{ method: 'get', path: '/api/v1/alerts/resolved/groups' },
	{ method: 'delete', path: '/api/v1/alerts/resolved/:alertId' },
	{ method: 'patch', path: '/api/v1/alerts/resolved/:id/owner' },
	{ method: 'patch', path: '/api/v1/alerts/resolved/:id/unresolve' },
	{ method: 'patch', path: '/api/v1/alerts/comments/:commentId' },
	{ method: 'delete', path: '/api/v1/alerts/comments/:commentId' },
	{ method: 'get', path: '/api/v1/alerts/:alertId/history' },
	{ method: 'put', path: '/api/v1/alerts/:alertId/root-cause' },
	{ method: 'get', path: '/api/v1/alerts/:alertId/root-cause' },
	{ method: 'post', path: '/api/v1/alerts/:alertId/root-cause/rating' },
	// secrets
	{ method: 'post', path: '/api/v1/secrets' },
	{ method: 'get', path: '/api/v1/secrets' },
	{ method: 'put', path: '/api/v1/secrets/:id' },
	{ method: 'delete', path: '/api/v1/secrets/:id' },
	// custom-fields
	{ method: 'post', path: '/api/v1/custom-fields' },
	{ method: 'get', path: '/api/v1/custom-fields' },
	{ method: 'get', path: '/api/v1/custom-fields/:id' },
	{ method: 'put', path: '/api/v1/custom-fields/:id' },
	{ method: 'delete', path: '/api/v1/custom-fields/:id' },
	// mute-policies
	{ method: 'get', path: '/api/v1/mute-policies' },
	{ method: 'post', path: '/api/v1/mute-policies' },
	{ method: 'get', path: '/api/v1/mute-policies/:mutePolicyId' },
	{ method: 'put', path: '/api/v1/mute-policies/:mutePolicyId' },
	{ method: 'delete', path: '/api/v1/mute-policies/:mutePolicyId' },
	// oncall
	{ method: 'get', path: '/api/v1/oncall/teams' },
	{ method: 'post', path: '/api/v1/oncall/teams' },
	{ method: 'patch', path: '/api/v1/oncall/teams/:teamId' },
	{ method: 'delete', path: '/api/v1/oncall/teams/:teamId' },
	{ method: 'put', path: '/api/v1/oncall/teams/:teamId/members' },
	// enrichments
	{ method: 'get', path: '/api/v1/enrichments' },
	{ method: 'post', path: '/api/v1/enrichments' },
	{ method: 'get', path: '/api/v1/enrichments/:enrichmentId/history' },
	{ method: 'get', path: '/api/v1/enrichments/:enrichmentId' },
	{ method: 'put', path: '/api/v1/enrichments/:enrichmentId' },
	{ method: 'delete', path: '/api/v1/enrichments/:enrichmentId' },
	// actions
	{ method: 'get', path: '/api/v1/actions' },
	{ method: 'post', path: '/api/v1/actions' },
	{ method: 'post', path: '/api/v1/actions/test' },
	{ method: 'post', path: '/api/v1/actions/:actionId/preview' },
	{ method: 'post', path: '/api/v1/actions/:actionId/run' },
	{ method: 'get', path: '/api/v1/actions/:actionId' },
	{ method: 'put', path: '/api/v1/actions/:actionId' },
	{ method: 'delete', path: '/api/v1/actions/:actionId' },
	// audit
	{ method: 'get', path: '/api/v1/audit' },
	// retention
	{ method: 'get', path: '/api/v1/retention' },
	{ method: 'put', path: '/api/v1/retention/config' },
	{ method: 'post', path: '/api/v1/retention/run' },
	{ method: 'put', path: '/api/v1/retention/policies/:resourceType' },
	// ai
	{ method: 'get', path: '/api/v1/ai/status' },
	{ method: 'post', path: '/api/v1/ai/filter' },
	{ method: 'get', path: '/api/v1/ai/config' },
	{ method: 'put', path: '/api/v1/ai/config' },
	{ method: 'post', path: '/api/v1/ai/test' },
	// ldap
	{ method: 'get', path: '/api/v1/ldap/settings' },
	{ method: 'put', path: '/api/v1/ldap/settings' },
	{ method: 'post', path: '/api/v1/ldap/test' },
];
