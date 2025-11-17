import { SavedView } from '@/types/SavedView';
import {
	AuditLog,
	DiscoveredService,
	Integration,
	IntegrationType,
	Logger,
	Provider,
	Service,
	ServiceWithProvider,
	Alert as SharedAlert,
	Tag,
} from '@OpsiMate/shared';
import { CustomAction } from '@OpsiMate/custom-actions';

const logger = new Logger('api');
const { protocol, hostname } = window.location;
export const EMAIL_STATUS_URL = `${protocol}//${hostname}:3001/email-status`;
export const API_BASE_URL = `${protocol}//${hostname}:3001/api/v1`;
export type ApiResponse<T = unknown> = {
	success: boolean;
	data?: T;
	error?: string;
	[key: string]: unknown; // Allow extra properties like token
};

/**
 * Generic API request handler
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

			if (response.status === 401) {
				localStorage.removeItem('jwt');

				const authPages = new Set(['/login', '/register', '/forgot-password', '/reset-password']);
				if (!authPages.has(location.pathname)) {
					// navigate to login /login
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
 * Views API endpoints
 */
export const viewsApi = {
	// Get all views for the current user
	getViews: () => {
		return apiRequest<SavedView[]>('/views');
	},

	// Get a specific view
	getView: (viewId: string) => {
		return apiRequest<SavedView>(`/views/${viewId}`);
	},

	// Save a view (create or update)
	saveView: (view: SavedView) => {
		return apiRequest<SavedView>('/views', 'POST', view);
	},

	// Delete a view
	deleteView: (viewId: string) => {
		return apiRequest<{ message: string }>(`/views/${viewId}`, 'DELETE');
	},

	// Set active view
	setActiveView: (viewId: string) => {
		return apiRequest<{ message: string }>(`/views/active/${viewId}`, 'POST');
	},

	// Get active view ID
	getActiveViewId: () => {
		return apiRequest<{ activeViewId: string | null }>('/views/active');
	},
};

/**
 * Provider API endpoints
 */
export const providerApi = {
	// Provider APIs

	// Get all providers
	getProviders: async () => {
		try {
			const response = await apiRequest<{
				providers: Array<{
					id: number;
					name: string;
					providerIP: string;
					username: string;
					privateKeyFilename: string;
					providerType: string;
					SSHPort: number;
					createdAt: string;
				}>;
			}>('/providers');

			// The server already returns camelCase, so no transformation needed
			if (response.success && response.data && response.data.providers) {
				const transformedProviders = response.data.providers.map(
					(provider: {
						id: number;
						name: string;
						providerIP: string;
						username: string;
						privateKeyFilename: string;
						providerType: string;
						SSHPort: number;
						createdAt: string;
					}) => ({
						id: provider.id,
						name: provider.name,
						providerIP: provider.providerIP,
						username: provider.username,
						privateKeyFilename: provider.privateKeyFilename,
						SSHPort: provider.SSHPort,
						createdAt: provider.createdAt,
						providerType: provider.providerType,
					})
				);

				return {
					success: response.success,
					data: { providers: transformedProviders },
				};
			}

			return response;
		} catch (error) {
			logger.error('Error fetching providers:', error);
			return { success: false, error: 'Failed to fetch providers' };
		}
	},

	// Get a specific provider
	getProvider: (providerId: number) => {
		return apiRequest<Provider>(`/providers/${providerId}`);
	},

	// Refresh provider and get real-time service status
	refreshProvider: (providerId: number) => {
		return apiRequest<{ provider: Provider; services: Service[] }>(`/providers/${providerId}/refresh`, 'POST');
	},

	// Create a new provider
	createProvider: (providerData: {
		name: string;
		providerIP?: string;
		username?: string;
		privateKeyFilename?: string;
		password?: string;
		SSHPort?: number;
		providerType: string;
	}) => {
		return apiRequest<Provider>('/providers', 'POST', providerData);
	},

	// Create multiple providers in bulk
	createProvidersBulk: (
		providers: Array<{
			name: string;
			providerIP?: string;
			username?: string;
			privateKeyFilename?: string;
			password?: string;
			SSHPort?: number;
			providerType: string;
		}>
	) => {
		return apiRequest<{ success: true } | { success: false; error: string }>('/providers/bulk', 'POST', {
			providers,
		});
	},

	// Get provider instances (services)
	getProviderInstances: (providerId: number) => {
		return apiRequest<DiscoveredService[]>(`/providers/${providerId}/discover-services`);
	},

	// Add services in bulk
	addServicesBulk: (providerId: number, serviceNames: string[]) => {
		return apiRequest<Array<{ id: string; name: string }>>(`/providers/${providerId}/instance/bulk`, 'POST', {
			service_names: serviceNames,
		});
	},

	// Get services for a provider
	getProviderServices: (providerId: number) => {
		return apiRequest<
			Array<{
				id: string;
				name: string;
				serviceIP: string;
				serviceStatus: string;
				serviceType: string;
			}>
		>(`/providers/${providerId}/services`);
	},

	// Delete a provider
	deleteProvider: (providerId: number) => {
		return apiRequest<void>(`/providers/${providerId}`, 'DELETE');
	},

	// Update a provider
	updateProvider: (
		providerId: number,
		providerData: {
			name: string;
			providerIP: string;
			username: string;
			secretId?: number;
			password?: string;
			SSHPort?: number;
			providerType: string;
		}
	) => {
		// Send data in camelCase format as expected by the server schema
		return apiRequest<Provider>(`/providers/${providerId}`, 'PUT', providerData);
	},

	// Test provider connection
	testProviderConnection: (providerData: {
		name: string;
		providerIP: string;
		username: string;
		secretId?: number;
		password?: string;
		SSHPort?: number;
		providerType: string;
	}) => {
		return apiRequest<{ isValidConnection: boolean }>('/providers/test-connection', 'POST', providerData);
	},

	// Service APIs

	// Get all services with provider details
	getAllServices: () => {
		return apiRequest<ServiceWithProvider[]>('/services');
	},

	// Get a specific service with provider details
	getServiceById: (serviceId: number) => {
		return apiRequest<ServiceWithProvider>(`/services/${serviceId}`);
	},

	// Create a new service
	createService: (serviceData: {
		providerId: number;
		name: string;
		serviceIP?: string;
		serviceStatus?: string;
		serviceType: 'MANUAL' | 'DOCKER' | 'SYSTEMD';
		containerDetails?: {
			id?: string;
			image?: string;
			created?: string;
			namespace?: string;
		};
	}) => {
		return apiRequest<ServiceWithProvider>('/services', 'POST', {
			providerId: serviceData.providerId,
			name: serviceData.name,
			serviceType: serviceData.serviceType,
			...(serviceData.serviceIP && { serviceIP: serviceData.serviceIP }),
			...(serviceData.serviceStatus && { serviceStatus: serviceData.serviceStatus }),
			...(serviceData.containerDetails && { containerDetails: serviceData.containerDetails }),
		});
	},

	// Update a service
	updateService: (
		serviceId: number,
		serviceData: Partial<{
			providerId: number;
			name: string;
			serviceIP: string;
			serviceStatus: string;
			serviceType: string;
			containerDetails: {
				id?: string;
				image?: string;
				created?: string;
			};
		}>
	) => {
		return apiRequest<ServiceWithProvider>(`/services/${serviceId}`, 'PUT', serviceData);
	},

	// Delete a service
	deleteService: (serviceId: number) => {
		return apiRequest<void>(`/services/${serviceId}`, 'DELETE');
	},

	// Start a service
	startService: (serviceId: number) => {
		return apiRequest<ServiceWithProvider>(`/services/${serviceId}/start`, 'POST');
	},

	// Stop a service
	stopService: (serviceId: number) => {
		return apiRequest<ServiceWithProvider>(`/services/${serviceId}/stop`, 'POST');
	},

	// Get service logs
	getServiceLogs: (serviceId: number) => {
		// Make sure we're using the correct path
		return apiRequest<string[]>(`/services/${serviceId}/logs`, 'GET');
	},

	// Get service logs
	getServicePods: (serviceId: number) => {
		// Make sure we're using the correct path
		return apiRequest<{ name: string }[]>(`/services/${serviceId}/pods`, 'GET');
	},

	// Tag APIs

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
export const alertsApi = {
	// Get all alerts
	async getAllAlerts(): Promise<ApiResponse<{ alerts: SharedAlert[] }>> {
		return await apiRequest<{ alerts: SharedAlert[] }>('/alerts');
	},

	// Dismiss an alert
	async dismissAlert(alertId: string): Promise<ApiResponse<{ alert: SharedAlert }>> {
		return await apiRequest<{ alert: SharedAlert }>(`/alerts/${alertId}/dismiss`, 'PATCH');
	},

	// Undismiss an alert
	async undismissAlert(alertId: string): Promise<ApiResponse<{ alert: SharedAlert }>> {
		return await apiRequest<{ alert: SharedAlert }>(`/alerts/${alertId}/undismiss`, 'PATCH');
	},

	// Delete an alert
	async deleteAlert(alertId: string): Promise<ApiResponse<void>> {
		return await apiRequest<void>(`/alerts/${alertId}`, 'DELETE');
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
};

export const auditApi = {
	getAuditLogs: async (page = 1, pageSize = 20) => {
		return apiRequest<{ logs: AuditLog[]; total: number }>(`/audit?page=${page}&pageSize=${pageSize}`);
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

export { apiRequest };
