import { CustomAction } from '@OpsiMate/custom-actions';
import {
	AlertBulkActionRequest,
	AlertBulkActionResult,
	AlertGroupSummaryNode,
	Action,
	ActionConfig,
	ActionOverrides,
	ActionPreview,
	ActionTestResult,
	ActionType,
	AlertHistory,
	AlertEnrichment,
	MutePolicy,
	AuditLog,
	Integration,
	IntegrationType,
	Logger,
	RetentionConfig,
	RetentionPolicy,
	RetentionResource,
	RetentionRunResult,
	RetentionSettings,
	SilenceResetSettings,
	UpdateSilenceResetSettings,
	Alert as SharedAlert,
	OncallTeam,
	Tag,
} from '@OpsiMate/shared';
import { isPlaygroundMode } from './playground';

const logger = new Logger('api');
const { protocol, hostname, port } = window.location;

// In production (standard ports 80/443), don't add a port suffix
// In development (e.g., port 5173), use port 3001 for the API
const isStandardPort = port === '' || port === '80' || port === '443';

export const API_HOST = isStandardPort ? `${protocol}//${hostname}` : `${protocol}//${hostname}:3001`;
export const EMAIL_STATUS_URL = `${API_HOST}/email-status`;
export const API_BASE_URL = `${API_HOST}/api/v1`;
export type ApiResponse<T = unknown> = {
	success: boolean;
	data?: T;
	error?: string;
	[key: string]: unknown;
};

/**
 * Generic API request handler
 * In playground mode, MSW intercepts requests at the network level
 */
async function apiRequest<T>(
	endpoint: string,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
	data?: unknown
): Promise<ApiResponse<T>> {
	const url = `${API_BASE_URL}${endpoint}`;

	const token = localStorage.getItem('jwt');
	const options: RequestInit = {
		method,
		headers: {
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		credentials: 'include',
	};

	if (data) {
		if (data instanceof FormData) {
			// Don't set Content-Type for FormData, let the browser set it with boundary
			options.body = data;
		} else {
			// For JSON data, set Content-Type and stringify
			options.headers = {
				...options.headers,
				'Content-Type': 'application/json',
			};
			options.body = JSON.stringify(data);
		}
	}

	try {
		logger.debug(`API Request: ${method} ${url}`, data ? { extraArgs: { data } } : undefined);
		const response = await fetch(url, options);

		if (!response.ok) {
			const errorText = await response.text();
			logger.error(`API Error (${response.status}):`, errorText);
			// Try to parse the error as JSON to handle validation errors properly

			if (response.status === 401 && !isPlaygroundMode()) {
				localStorage.removeItem('jwt');

				const authPages = new Set(['/login', '/register', '/forgot-password', '/reset-password']);
				if (!authPages.has(window.location.pathname)) {
					window.location.href = '/login?expired=true';
				}
			}

			try {
				const errorJson = JSON.parse(errorText);
				return {
					success: false,
					...errorJson, // Spread the parsed JSON to preserve validation details
				};
			} catch {
				// If it's not JSON, return as a simple error string
				return {
					success: false,
					error: `HTTP ${response.status}: ${errorText || 'Unknown error'}`,
				};
			}
		}

		const result = await response.json();
		logger.debug(`API Response (${method} ${url}):`, result);
		return result as ApiResponse<T>;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		logger.error(`API Error (${method} ${endpoint}):`, errorMessage, error);
		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Tag API endpoints
 */
export const tagApi = {
	// Get all tags
	getAllTags: () => {
		return apiRequest<Tag[]>('/tags');
	},

	// Get a specific tag
	getTagById: (tagId: number) => {
		return apiRequest<Tag>(`/tags/${tagId}`);
	},

	// Create a new tag
	createTag: (tagData: { name: string; color: string }) => {
		return apiRequest<Tag>('/tags', 'POST', tagData);
	},

	// Update a tag
	updateTag: (tagId: number, tagData: Partial<{ name: string; color: string }>) => {
		return apiRequest<Tag>(`/tags/${tagId}`, 'PUT', tagData);
	},

	// Delete a tag
	deleteTag: (tagId: number) => {
		return apiRequest<void>(`/tags/${tagId}`, 'DELETE');
	},

	// Add tag to service
	addTagToService: (serviceId: number, tagId: number) => {
		return apiRequest<{ message: string }>(`/services/${serviceId}/tags`, 'POST', { tagId });
	},

	// Remove tag from service
	removeTagFromService: (serviceId: number, tagId: number) => {
		return apiRequest<{ message: string }>(`/services/${serviceId}/tags/${tagId}`, 'DELETE');
	},

	// Get tags for a service
	getServiceTags: (serviceId: number) => {
		return apiRequest<Tag[]>(`/services/${serviceId}/tags`);
	},
};

/**
 * Integration API endpoints
 */
export const integrationApi = {
	// Get all integrations
	getIntegrations: async () => {
		try {
			const response = await apiRequest<{ integrations: Integration[] }>('/integrations');
			return response;
		} catch (error) {
			logger.error('Error getting integrations:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			};
		}
	},

	// Create a new integration
	createIntegration: async (integrationData: {
		name: string;
		type: IntegrationType;
		externalUrl: string;
		credentials: Record<string, string>;
	}) => {
		try {
			const response = await apiRequest<Integration>('/integrations', 'POST', integrationData);
			return response;
		} catch (error) {
			logger.error('Error creating integration:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			};
		}
	},

	// Update an integration
	updateIntegration: async (
		integrationId: number,
		integrationData: {
			name: string;
			type: IntegrationType;
			externalUrl: string;
			credentials: Record<string, string>;
		}
	) => {
		try {
			const response = await apiRequest<Integration>(`/integrations/${integrationId}`, 'PUT', integrationData);
			return response;
		} catch (error) {
			logger.error('Error updating integration:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			};
		}
	},

	// Delete an integration
	deleteIntegration: async (integrationId: number) => {
		try {
			const response = await apiRequest<{ message: string }>(`/integrations/${integrationId}`, 'DELETE');
			return response;
		} catch (error) {
			logger.error('Error deleting integration:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			};
		}
	},

	// Get integration URLs
	getIntegrationUrls: async (integrationId: number, tags: string[]) => {
		try {
			// The server expects a single 'tags' parameter with a comma-separated list
			// This matches the IntegrationTagsquerySchema in the server
			const tagsParam = tags.join(',');
			const response = await apiRequest<{ name: string; url: string }[]>(
				`/integrations/${integrationId}/urls?tags=${encodeURIComponent(tagsParam)}`
			);
			return response;
		} catch (error) {
			logger.error('Error getting integration URLs:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			};
		}
	},
};

/**
 * Alerts API endpoints
 */
// Alert IDs are caller-supplied (custom alerts API) and may contain URL-hostile
// characters (#, /, ?, %); any ID placed in a request path must be encoded or the
// browser truncates/mangles the URL.
// Server-side list query (Phase 1): the same filter record the dashboard stores, a
// concrete time window, search, and paging. Undefined/empty params are omitted so a
// paramless call keeps the legacy full-list response.
export interface AlertQueryParams {
	filters?: Record<string, string[]>;
	from?: string | null;
	to?: string | null;
	search?: string;
	sort?: string;
	dir?: 'asc' | 'desc';
	limit?: number;
	cursor?: string;
}

export interface AlertListResponse {
	alerts: SharedAlert[];
	total?: number;
	nextCursor?: string | null;
}

export interface AlertFacetTagKey {
	key: string;
	label: string;
	values: string[];
}

export interface AlertFacetsResponse {
	facets: Record<string, Record<string, number>>;
	total: number;
	silencedTotal: number;
	tagKeys: AlertFacetTagKey[];
}

export interface AlertFacetsOptions {
	resolved?: boolean;
}

const alertQueryString = (params?: AlertQueryParams): string => {
	if (!params) return '';
	const q = new URLSearchParams();
	if (params.filters && Object.keys(params.filters).length > 0) q.set('filters', JSON.stringify(params.filters));
	if (params.from) q.set('from', params.from);
	if (params.to) q.set('to', params.to);
	if (params.search?.trim()) q.set('search', params.search);
	if (params.sort) q.set('sort', params.sort);
	if (params.dir) q.set('dir', params.dir);
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.cursor) q.set('cursor', params.cursor);
	const qs = q.toString();
	return qs ? `?${qs}` : '';
};

export const alertsApi = {
	// Get alerts; with params the server filters/sorts/pages, without them the full list.
	async getAllAlerts(params?: AlertQueryParams): Promise<ApiResponse<AlertListResponse>> {
		return await apiRequest<AlertListResponse>(`/alerts${alertQueryString(params)}`);
	},

	// Group counts + rollup status over the full matching set — no alerts in the payload.
	async getAlertGroupSummaries(
		groupBy: string[],
		params: Omit<AlertQueryParams, 'limit' | 'cursor' | 'sort' | 'dir'>,
		options?: AlertFacetsOptions
	): Promise<ApiResponse<{ groups: AlertGroupSummaryNode[] }>> {
		const q = new URLSearchParams();
		q.set('groupBy', JSON.stringify(groupBy));
		if (params.filters && Object.keys(params.filters).length > 0) q.set('filters', JSON.stringify(params.filters));
		if (params.from) q.set('from', params.from);
		if (params.to) q.set('to', params.to);
		if (params.search?.trim()) q.set('search', params.search);
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (timeZone) q.set('timeZone', timeZone);
		const base = options?.resolved ? '/alerts/resolved/groups' : '/alerts/groups';
		return await apiRequest<{ groups: AlertGroupSummaryNode[] }>(`${base}?${q.toString()}`);
	},

	// One request mutates many active alerts at once — scoped by explicit ids (the loaded
	// selection, one request instead of N) or by a query the server resolves against the
	// full dataset ("apply to all N matching"). Exactly one scope must be set.
	async bulkAlertAction(body: AlertBulkActionRequest): Promise<ApiResponse<AlertBulkActionResult>> {
		// The server's query schema rejects null/empty members the dashboard state may
		// carry (from/to null when "All time", empty search) — send only concrete values.
		const query = body.query
			? {
					...(body.query.filters && Object.keys(body.query.filters).length > 0
						? { filters: body.query.filters }
						: {}),
					...(body.query.from ? { from: body.query.from } : {}),
					...(body.query.to ? { to: body.query.to } : {}),
					...(body.query.search?.trim() ? { search: body.query.search } : {}),
				}
			: undefined;
		// The server caps a single request at 10k ids; a deep-scrolled select-all can
		// exceed that, so oversized id lists go up in sequential chunks with the counts
		// summed — one logical action to the caller either way. A chunk that fails must
		// NOT discard the counts of chunks that already applied: earlier mutations are
		// real, so the unprocessed remainder folds into `failed` and the caller's toast
		// reports an honest partial result instead of a blanket error.
		if (body.ids && body.ids.length > 10000) {
			const totals = { matched: 0, succeeded: 0, failed: 0 };
			for (let i = 0; i < body.ids.length; i += 10000) {
				const chunk = body.ids.slice(i, i + 10000);
				const response = await apiRequest<AlertBulkActionResult>('/alerts/bulk', 'POST', {
					...body,
					ids: chunk,
					query: undefined,
				});
				if (!response.success || !response.data) {
					const remaining = body.ids.length - i;
					totals.matched += remaining;
					totals.failed += remaining;
					return { success: true, data: totals };
				}
				totals.matched += response.data.matched;
				totals.succeeded += response.data.succeeded;
				totals.failed += response.data.failed;
			}
			return { success: true, data: totals };
		}
		return await apiRequest<AlertBulkActionResult>('/alerts/bulk', 'POST', {
			...body,
			query,
		});
	},

	// Faceted sidebar counts + tag keys over the raw dataset, computed server-side.
	async getAlertFacets(
		filters: Record<string, string[]>,
		options?: AlertFacetsOptions
	): Promise<ApiResponse<AlertFacetsResponse>> {
		const q = new URLSearchParams();
		if (Object.keys(filters).length > 0) q.set('filters', JSON.stringify(filters));
		const base = options?.resolved ? '/alerts/resolved/facets' : '/alerts/facets';
		const qs = q.toString();
		return await apiRequest<AlertFacetsResponse>(`${base}${qs ? `?${qs}` : ''}`);
	},

	// Silence an alert until `silencedUntil` (ISO; null = forever). Re-silencing overwrites
	// the expiry, restarting the timer. An optional note is stored as a comment.
	async silenceAlert(
		alertId: string,
		options?: { silencedUntil?: string | null; comment?: string }
	): Promise<ApiResponse<{ alert: SharedAlert }>> {
		return await apiRequest<{ alert: SharedAlert }>(`/alerts/${encodeURIComponent(alertId)}/silence`, 'PATCH', {
			silencedUntil: options?.silencedUntil ?? null,
			comment: options?.comment,
		});
	},

	// Unsilence an alert
	async unsilenceAlert(alertId: string): Promise<ApiResponse<{ alert: SharedAlert }>> {
		return await apiRequest<{ alert: SharedAlert }>(`/alerts/${encodeURIComponent(alertId)}/unsilence`, 'PATCH');
	},

	// Delete an alert (the UI's manual resolve); an optional note is stored as a comment.
	async deleteAlert(alertId: string, comment?: string): Promise<ApiResponse<void>> {
		return await apiRequest<void>(
			`/alerts/${encodeURIComponent(alertId)}`,
			'DELETE',
			comment ? { comment } : undefined
		);
	},

	// Mark alert as read (unread alerts render bold in the table)
	async markAlertRead(alertId: string): Promise<ApiResponse<{ alert: SharedAlert }>> {
		return await apiRequest<{ alert: SharedAlert }>(`/alerts/${encodeURIComponent(alertId)}/read`, 'PATCH');
	},

	getAlertHistory: (alertId: string) => {
		return apiRequest<AlertHistory>(`/alerts/${encodeURIComponent(alertId)}/history`, 'GET');
	},

	// Get alerts by tag
	async getAlertsByTag(tag: string): Promise<ApiResponse<{ alerts: SharedAlert[] }>> {
		const response = await this.getAllAlerts();
		if (response.success && response.data) {
			const filteredAlerts = response.data.alerts.filter((alert) => alert.tag === tag);
			return {
				success: true,
				data: { alerts: filteredAlerts },
			};
		}
		return response;
	},

	// Get alerts by multiple tags (for services with multiple tags)
	async getAlertsByTags(tags: string[]): Promise<ApiResponse<{ alerts: SharedAlert[] }>> {
		const response = await this.getAllAlerts();
		if (response.success && response.data) {
			const filteredAlerts = response.data.alerts.filter((alert) => tags.includes(alert.tag));
			// Remove duplicates
			const uniqueAlerts = filteredAlerts.filter(
				(alert, index, self) => index === self.findIndex((a) => a.id === alert.id)
			);
			return {
				success: true,
				data: { alerts: uniqueAlerts },
			};
		}
		return response;
	},

	// Get resolved alerts; same query contract as the active list.
	async getAllResolvedAlerts(params?: AlertQueryParams): Promise<ApiResponse<AlertListResponse>> {
		return await apiRequest<AlertListResponse>(`/alerts/resolved${alertQueryString(params)}`);
	},

	// Delete an resolved alert permanently
	async deleteResolvedAlert(alertId: string): Promise<ApiResponse<void>> {
		return await apiRequest<void>(`/alerts/resolved/${encodeURIComponent(alertId)}`, 'DELETE');
	},

	// Move a resolved alert back to the active (firing) list
	async unresolveAlert(alertId: string): Promise<ApiResponse<{ alert: SharedAlert }>> {
		return await apiRequest<{ alert: SharedAlert }>(
			`/alerts/resolved/${encodeURIComponent(alertId)}/unresolve`,
			'PATCH'
		);
	},

	// Set alert owner
	async setAlertOwner(alertId: string, ownerId: string | null): Promise<ApiResponse<{ alert: SharedAlert }>> {
		return await apiRequest<{ alert: SharedAlert }>(`/alerts/${encodeURIComponent(alertId)}/owner`, 'PATCH', {
			ownerId,
		});
	},

	// Set resolved alert owner
	async setResolvedAlertOwner(alertId: string, ownerId: string | null): Promise<ApiResponse<{ alert: SharedAlert }>> {
		return await apiRequest<{ alert: SharedAlert }>(
			`/alerts/resolved/${encodeURIComponent(alertId)}/owner`,
			'PATCH',
			{ ownerId }
		);
	},
};

export type MutePolicyPayload = {
	name: string;
	nameContains?: string | null;
	labelMatchers?: { key: string; value: string }[];
	labelMatcherGroups?: { key: string; value: string }[][];
	matchAll?: boolean;
	startsAt?: string | null;
	endsAt?: string | null;
	schedule?: { daysOfWeek: number[]; startTime: string; endTime: string } | null;
	reason?: string | null;
};

export const mutePoliciesApi = {
	listMutePolicies: () => apiRequest<MutePolicy[]>('/mute-policies'),
	getMutePolicy: (id: number) => apiRequest<MutePolicy>(`/mute-policies/${id}`),
	createMutePolicy: (payload: MutePolicyPayload) => apiRequest<MutePolicy>('/mute-policies', 'POST', payload),
	updateMutePolicy: (id: number, payload: Partial<MutePolicyPayload>) =>
		apiRequest<MutePolicy>(`/mute-policies/${id}`, 'PUT', payload),
	deleteMutePolicy: (id: number) => apiRequest<void>(`/mute-policies/${id}`, 'DELETE'),
};

export type OncallTeamPayload = {
	name: string;
	rotationIntervalDays: number | null;
};

export const oncallApi = {
	getTeams: () => apiRequest<{ teams: OncallTeam[] }>('/oncall/teams'),
	createTeam: (payload: OncallTeamPayload) => apiRequest<{ team: OncallTeam }>('/oncall/teams', 'POST', payload),
	updateTeam: (teamId: number, payload: Partial<OncallTeamPayload>) =>
		apiRequest<{ team: OncallTeam }>(`/oncall/teams/${teamId}`, 'PATCH', payload),
	deleteTeam: (teamId: number) => apiRequest<void>(`/oncall/teams/${teamId}`, 'DELETE'),
	// Ordered list — index 0 becomes call priority 1; saving restarts the rotation clock.
	setTeamMembers: (teamId: number, userIds: string[]) =>
		apiRequest<{ team: OncallTeam }>(`/oncall/teams/${teamId}/members`, 'PUT', { userIds }),
};

export type EnrichmentPayload = {
	name: string;
	nameContains?: string | null;
	labelMatchers?: { key: string; value: string }[];
	labelMatcherGroups?: { key: string; value: string }[][];
	matchAll?: boolean;
	addFields?: { key: string; value: string }[];
	addLinks?: { label: string; icon?: string; url: string }[];
	summaryTemplate?: string | null;
	priority?: number;
};

export const enrichmentsApi = {
	listEnrichments: () => apiRequest<AlertEnrichment[]>('/enrichments'),
	getEnrichment: (id: number) => apiRequest<AlertEnrichment>(`/enrichments/${id}`),
	createEnrichment: (payload: EnrichmentPayload) => apiRequest<AlertEnrichment>('/enrichments', 'POST', payload),
	updateEnrichment: (id: number, payload: Partial<EnrichmentPayload>) =>
		apiRequest<AlertEnrichment>(`/enrichments/${id}`, 'PUT', payload),
	deleteEnrichment: (id: number) => apiRequest<void>(`/enrichments/${id}`, 'DELETE'),
};

export type ActionPayload = {
	name: string;
	type: ActionType;
	config: ActionConfig;
	nameContains?: string | null;
	labelMatchers?: { key: string; value: string }[];
	labelMatcherGroups?: { key: string; value: string }[][];
};

export const actionsApi = {
	listActions: () => apiRequest<Action[]>('/actions'),
	getAction: (id: number) => apiRequest<Action>(`/actions/${id}`),
	createAction: (payload: ActionPayload) => apiRequest<Action>('/actions', 'POST', payload),
	updateAction: (id: number, payload: ActionPayload) => apiRequest<Action>(`/actions/${id}`, 'PUT', payload),
	deleteAction: (id: number) => apiRequest<void>(`/actions/${id}`, 'DELETE'),
	testAction: (payload: ActionPayload) => apiRequest<ActionTestResult>('/actions/test', 'POST', payload),
	previewAction: (id: number, alert: SharedAlert) =>
		apiRequest<ActionPreview>(`/actions/${id}/preview`, 'POST', { alert }),
	runAction: (id: number, alert: SharedAlert, overrides?: ActionOverrides) =>
		apiRequest<ActionTestResult>(`/actions/${id}/run`, 'POST', { alert, overrides }),
};

export const auditApi = {
	getAuditLogs: async (page = 1, pageSize = 20) => {
		return apiRequest<{ logs: AuditLog[]; total: number }>(`/audit?page=${page}&pageSize=${pageSize}`);
	},
};

/**
 * Data retention API endpoints (admin only)
 */
export const retentionApi = {
	getSettings: () => apiRequest<RetentionSettings>('/retention'),
	updateConfig: (updates: { cleanupIntervalHours?: number; vacuumAfterCleanup?: boolean }) =>
		apiRequest<RetentionConfig>('/retention/config', 'PUT', updates),
	updatePolicy: (resourceType: RetentionResource, updates: { enabled?: boolean; retentionDays?: number }) =>
		apiRequest<RetentionPolicy>(`/retention/policies/${resourceType}`, 'PUT', updates),
	runNow: () => apiRequest<RetentionRunResult>('/retention/run', 'POST'),
};

// Org-wide daily silence reset (admin-only endpoints).
export const silenceResetApi = {
	getSettings: () => apiRequest<SilenceResetSettings>('/alerts/silence-reset'),
	updateSettings: (updates: UpdateSilenceResetSettings) =>
		apiRequest<SilenceResetSettings>('/alerts/silence-reset', 'PUT', updates),
};

/**
 * Playground API endpoints
 */
export const playgroundApi = {
	bookDemo: async (payload: { email?: string; trackingId: string }) => {
		return apiRequest<void>('/playground/book-demo', 'POST', payload);
	},
};

/**
 * Secrets API endpoints
 */
export const secretsApi = {
	// Get all secrets
	getSecrets: async () => {
		try {
			const response = await apiRequest<{
				secrets: Array<{ id: string; name: string; value: string }>;
			}>('/secrets');
			return response;
		} catch (error) {
			logger.error('Error getting secrets:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			};
		}
	},

	// Create a new secret
	createSecret: async (displayName: string, file: File, secretType: 'ssh' | 'kubeconfig' = 'ssh') => {
		try {
			const formData = new FormData();
			formData.append('displayName', displayName);
			formData.append('secret_file', file);
			formData.append('secretType', secretType);

			const response = await apiRequest<{ id: number }>('/secrets', 'POST', formData);
			return response;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			logger.error('API Error (POST /secrets):', error);
			return {
				success: false,
				error: errorMessage,
			};
		}
	},

	// Update a secret
	updateSecret: async (secretId: number, displayName?: string, file?: File, secretType?: 'ssh' | 'kubeconfig') => {
		try {
			const formData = new FormData();
			if (displayName !== undefined) {
				formData.append('displayName', displayName);
			}
			if (file !== undefined) {
				formData.append('secret_file', file);
			}
			if (secretType !== undefined) {
				formData.append('secretType', secretType);
			}

			const response = await apiRequest<{ message: string }>(`/secrets/${secretId}`, 'PUT', formData);
			return response;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			logger.error('API Error (PUT /secrets):', error);
			return {
				success: false,
				error: errorMessage,
			};
		}
	},

	// Delete a secret
	deleteSecret: async (secretId: number) => {
		try {
			const response = await apiRequest<{ message: string }>(`/secrets/${secretId}`, 'DELETE');
			return response;
		} catch (error) {
			logger.error('Error deleting secret:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			};
		}
	},
};

/**
 * Custom Actions API endpoints
 */
export const customActionsApi = {
	getActions: () => {
		return apiRequest<{ actions: CustomAction[] }>('/custom-actions');
	},

	getActionById: (actionId: number) => {
		return apiRequest<CustomAction>(`/custom-actions/${actionId}`);
	},

	createAction: (action: CustomAction) => {
		return apiRequest<{ id: number }>('/custom-actions', 'POST', action);
	},

	updateAction: (actionId: number, action: CustomAction) => {
		return apiRequest<void>(`/custom-actions/${actionId}`, 'PUT', action);
	},

	deleteAction: (actionId: number) => {
		return apiRequest<void>(`/custom-actions/${actionId}`, 'DELETE');
	},

	runForProvider: (providerId: number, actionId: number) => {
		return apiRequest<void>(`/custom-actions/run/provider/${providerId}/${actionId}`, 'POST');
	},

	runForService: (serviceId: number, actionId: number) => {
		return apiRequest<void>(`/custom-actions/run/service/${serviceId}/${actionId}`, 'POST');
	},
};

/**
 * Users API endpoints
 */
export const usersApi = {
	// Get all users
	getAllUsers: () => {
		return apiRequest<{ id: string; email: string; fullName: string; role: string; phoneNumber?: string | null }[]>(
			'/users'
		);
	},
};

export { apiRequest };
