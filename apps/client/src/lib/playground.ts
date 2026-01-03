import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { generateDiverseMockAlerts } from '@/mocks/mockAlerts.utils';
import { SavedView } from '@/types/SavedView';
import { CustomAction } from '@OpsiMate/custom-actions';
import {
	Alert,
	AlertComment,
	AlertHistory,
	AlertStatus,
	AuditActionType,
	AuditLog,
	AuditResourceType,
	Integration,
	IntegrationType,
	Provider,
	ProviderType,
	Role,
	ServiceType,
	ServiceWithProvider,
	Tag,
	User,
} from '@OpsiMate/shared';
import { PLAYGROUND_QUERY_KEYS } from './playground.constants';

export type PlaygroundMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

type PlaygroundResponse<T> = {
	success: boolean;
	data?: T;
	error?: string;
	[key: string]: unknown;
};

type PlaygroundState = {
	alerts: Alert[];
	archivedAlerts: Alert[];
	alertComments: AlertComment[];
	providers: Provider[];
	services: ServiceWithProvider[];
	tags: Tag[];
	integrations: Integration[];
	dashboards: Dashboard[];
	dashboardTags: Record<string, number[]>;
	views: SavedView[];
	activeViewId: string | null;
	users: User[];
	customActions: CustomAction[];
	auditLogs: AuditLog[];
};

const isBrowser = typeof window !== 'undefined';

export const isPlaygroundMode = (): boolean => {
	if (!isBrowser) return false;
	const params = new URLSearchParams(window.location.search);
	return PLAYGROUND_QUERY_KEYS.some((key) => {
		const value = params.get(key);
		return value === '' || value === 'true';
	});
};

export const getPlaygroundUser = (): User => ({
	id: '0',
	email: 'demo@opsimate.local',
	fullName: 'Playground Admin',
	role: Role.Admin,
	createdAt: new Date().toISOString(),
});

const nowIso = () => new Date().toISOString();

const createTags = (): Tag[] => [
	{ id: 1, name: 'production', color: '#DC2626', createdAt: nowIso() },
	{ id: 2, name: 'staging', color: '#7C3AED', createdAt: nowIso() },
	{ id: 3, name: 'database', color: '#2563EB', createdAt: nowIso() },
	{ id: 4, name: 'frontend', color: '#10B981', createdAt: nowIso() },
	{ id: 5, name: 'backend', color: '#F59E0B', createdAt: nowIso() },
	{ id: 6, name: 'security', color: '#EF4444', createdAt: nowIso() },
];

const createProviders = (): Provider[] => [
	{
		id: 1,
		name: 'Production API',
		providerIP: '10.0.0.10',
		username: 'ubuntu',
		privateKeyFilename: 'id_rsa_api',
		SSHPort: 22,
		createdAt: nowIso(),
		providerType: ProviderType.VM,
	},
	{
		id: 2,
		name: 'K8s Cluster',
		providerIP: '10.0.0.50',
		username: 'kube-admin',
		privateKeyFilename: 'id_rsa_k8s',
		SSHPort: 22,
		createdAt: nowIso(),
		providerType: ProviderType.K8S,
	},
	{
		id: 3,
		name: 'Analytics Nodes',
		providerIP: '10.0.1.20',
		username: 'analytics',
		privateKeyFilename: 'id_rsa_analytics',
		SSHPort: 22,
		createdAt: nowIso(),
		providerType: ProviderType.VM,
	},
];

const createServices = (providers: Provider[], tags: Tag[]): ServiceWithProvider[] => [
	{
		id: 1001,
		providerId: 1,
		name: 'api-gateway',
		serviceIP: '10.0.0.21',
		serviceStatus: 'running',
		serviceType: ServiceType.DOCKER,
		createdAt: nowIso(),
		provider: providers[0],
		tags: [tags[0], tags[4]],
		containerDetails: { id: 'container-1001', image: 'opsimate/api:latest', created: nowIso() },
	},
	{
		id: 1002,
		providerId: 1,
		name: 'billing-service',
		serviceIP: '10.0.0.31',
		serviceStatus: 'degraded',
		serviceType: ServiceType.DOCKER,
		createdAt: nowIso(),
		provider: providers[0],
		tags: [tags[0], tags[4]],
		containerDetails: { id: 'container-1002', image: 'opsimate/billing:edge', created: nowIso() },
	},
	{
		id: 1003,
		providerId: 2,
		name: 'kube-prometheus',
		serviceIP: '10.0.0.61',
		serviceStatus: 'running',
		serviceType: ServiceType.SYSTEMD,
		createdAt: nowIso(),
		provider: providers[1],
		tags: [tags[1], tags[3]],
		containerDetails: { namespace: 'monitoring' },
	},
	{
		id: 1004,
		providerId: 3,
		name: 'elasticsearch',
		serviceIP: '10.0.1.30',
		serviceStatus: 'running',
		serviceType: ServiceType.DOCKER,
		createdAt: nowIso(),
		provider: providers[2],
		tags: [tags[0], tags[2]],
		containerDetails: { id: 'container-1004', image: 'elastic/elasticsearch:8', created: nowIso() },
	},
];

const createIntegrations = (): Integration[] => [
	{
		id: 10,
		name: 'Grafana Alerts',
		type: IntegrationType.Grafana,
		externalUrl: 'https://grafana.opsimate.example.com',
		credentials: { apiKey: 'demo-key' },
		createdAt: nowIso(),
	},
	{
		id: 11,
		name: 'Datadog Webhooks',
		type: IntegrationType.Datadog,
		externalUrl: 'https://api.datadoghq.com',
		credentials: { apiKey: 'demo', appKey: 'demo' },
		createdAt: nowIso(),
	},
	{
		id: 12,
		name: 'Kibana Dashboards',
		type: IntegrationType.Kibana,
		externalUrl: 'https://kibana.opsimate.example.com',
		credentials: { apiKey: 'demo-kibana' },
		createdAt: nowIso(),
	},
];

const createDashboards = (): Dashboard[] => [
	{
		id: '101',
		name: 'Critical Alerts',
		type: 'alerts',
		description: 'Live view of high-priority alerts',
		filters: { severity: ['critical'], status: ['firing'] },
		visibleColumns: ['severity', 'status', 'owner', 'integration', 'startsAt'],
		query: '',
		groupBy: ['integration'],
		createdAt: nowIso(),
	},
	{
		id: '102',
		name: 'Production Services',
		type: 'services',
		description: 'Production fleet health',
		filters: { environment: ['production'] },
		visibleColumns: ['name', 'status', 'provider', 'tags'],
		query: '',
		groupBy: ['provider'],
		createdAt: nowIso(),
	},
];

const createViews = (): SavedView[] => [
	{
		id: 'v-1',
		name: 'All environments',
		description: 'Everything in one place',
		createdAt: nowIso(),
		filters: { status: [], tag: [] },
		visibleColumns: {},
		searchTerm: '',
		isDefault: 1,
	},
	{
		id: 'v-2',
		name: 'On-call',
		description: 'Alerts for on-call rotation',
		createdAt: nowIso(),
		filters: { status: ['firing'], severity: ['critical', 'warning'] },
		visibleColumns: {},
		searchTerm: 'service',
		isDefault: 0,
	},
];

const createUsers = (): User[] => [
	getPlaygroundUser(),
	{
		id: '1',
		email: 'editor@opsimate.local',
		fullName: 'Demo Editor',
		role: Role.Editor,
		createdAt: nowIso(),
	},
	{
		id: '2',
		email: 'viewer@opsimate.local',
		fullName: 'Demo Viewer',
		role: Role.Viewer,
		createdAt: nowIso(),
	},
];

const createCustomActions = (): CustomAction[] => [
	{
		id: 1,
		name: 'Restart container',
		description: 'Restart the selected service container',
		type: 'bash',
		target: 'service',
		script: 'docker restart {{serviceName}}',
	},
	{
		id: 2,
		name: 'Notify Slack',
		description: 'Send a Slack webhook',
		type: 'http',
		target: 'provider',
		url: 'https://hooks.slack.com/services/T000/B000/XXXX',
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{"text":"A demo action executed"}',
	},
];

const createAuditLogs = (): AuditLog[] => [
	{
		id: 1,
		actionType: AuditActionType.CREATE,
		resourceType: AuditResourceType.PROVIDER,
		resourceId: '1',
		resourceName: 'Production API',
		userId: Number(getPlaygroundUser().id),
		userName: getPlaygroundUser().fullName,
		timestamp: nowIso(),
		details: 'Provider created in playground',
	},
];

const seedAlerts = () => {
	const alerts = generateDiverseMockAlerts(180);
	return alerts.map((alert, idx) => ({
		...alert,
		ownerId: idx % 7 === 0 ? getPlaygroundUser().id : null,
	}));
};

const createArchivedAlerts = (alerts: Alert[]) =>
	alerts.slice(0, 12).map((alert, index) => ({
		...alert,
		id: `archived-${alert.id}-${index}`,
		isDismissed: true,
		status: AlertStatus.RESOLVED,
		updatedAt: new Date(Date.now() - 1000 * 60 * 60 * (index + 1)).toISOString(),
	}));

const initialTags = createTags();
const initialProviders = createProviders();
const initialServices = createServices(initialProviders, initialTags);
const initialAlerts = seedAlerts();

const playgroundState: PlaygroundState = {
	alerts: initialAlerts,
	archivedAlerts: createArchivedAlerts(initialAlerts),
	alertComments: [
		{
			id: 'c-1',
			alertId: initialAlerts[0]?.id || 'alert-1',
			userId: getPlaygroundUser().id,
			comment: 'Investigating this spike now.',
			createdAt: nowIso(),
			updatedAt: nowIso(),
		},
	],
	providers: initialProviders,
	services: initialServices,
	tags: initialTags,
	integrations: createIntegrations(),
	dashboards: createDashboards(),
	dashboardTags: { '102': [1] },
	views: createViews(),
	activeViewId: 'v-1',
	users: createUsers(),
	customActions: createCustomActions(),
	auditLogs: createAuditLogs(),
};

const randomId = (() => {
	let id = 5000;
	return () => ++id;
})();

const parsePath = (endpoint: string) => endpoint.split('?')[0].split('/').filter(Boolean);

const findService = (serviceId: number) => playgroundState.services.find((svc) => svc.id === serviceId);
const findProvider = (providerId: number) => playgroundState.providers.find((p) => p.id === providerId);

const maybeInjectNewAlert = () => {
	if (Math.random() > 0.25) return;
	const [newAlert] = generateDiverseMockAlerts(1);
	const alert: Alert = {
		...newAlert,
		id: `play-${Date.now()}`,
		startsAt: nowIso(),
		updatedAt: nowIso(),
		status: AlertStatus.FIRING,
	};
	playgroundState.alerts = [alert, ...playgroundState.alerts].slice(0, 250);
};

const withSuccess = <T>(data: T): PlaygroundResponse<T> => ({ success: true, data });
const withError = <T>(message: string): PlaygroundResponse<T> => ({ success: false, error: message });

export const playgroundApiRequest = async <T>(
	endpoint: string,
	method: PlaygroundMethod = 'GET',
	body?: unknown
): Promise<PlaygroundResponse<T>> => {
	if (!isPlaygroundMode()) {
		return withError('Playground mode disabled') as PlaygroundResponse<T>;
	}

	const segments = parsePath(endpoint);

	// Alerts
	if (endpoint.startsWith('/alerts')) {
		if (segments.length === 1 && method === 'GET') {
			maybeInjectNewAlert();
			return withSuccess<{ alerts: Alert[] }>({ alerts: playgroundState.alerts }) as PlaygroundResponse<T>;
		}

		if (segments[1] === 'archived' && method === 'GET' && segments.length === 2) {
			return withSuccess<{ alerts: Alert[] }>({
				alerts: playgroundState.archivedAlerts,
			}) as PlaygroundResponse<T>;
		}

		if (segments[1] === 'archived' && segments.length === 3 && method === 'DELETE') {
			const alertId = segments[2];
			playgroundState.archivedAlerts = playgroundState.archivedAlerts.filter((a) => a.id !== alertId);
			return withSuccess<void>(undefined as T);
		}

		if (segments[2] === 'dismiss' && method === 'PATCH') {
			const alertId = segments[1];
			const alertIndex = playgroundState.alerts.findIndex((a) => a.id === alertId);
			if (alertIndex !== -1) {
				const alert = { ...playgroundState.alerts[alertIndex] };
				alert.isDismissed = true;
				alert.status = AlertStatus.RESOLVED;
				alert.updatedAt = nowIso();

				playgroundState.alerts.splice(alertIndex, 1);
				playgroundState.archivedAlerts.unshift(alert);

				return withSuccess<{ alert: Alert }>({ alert }) as PlaygroundResponse<T>;
			}
			return withError('Alert not found in active alerts') as PlaygroundResponse<T>;
		}

		if (segments[2] === 'undismiss' && method === 'PATCH') {
			const alertId = segments[1];
			const archivedIndex = playgroundState.archivedAlerts.findIndex((a) => a.id === alertId);
			if (archivedIndex !== -1) {
				const alert = { ...playgroundState.archivedAlerts[archivedIndex] };
				alert.isDismissed = false;
				alert.status = AlertStatus.FIRING;
				alert.updatedAt = nowIso();

				playgroundState.archivedAlerts.splice(archivedIndex, 1);
				playgroundState.alerts.unshift(alert);

				return withSuccess<{ alert: Alert }>({ alert }) as PlaygroundResponse<T>;
			}
			return withError('Alert not found in archived alerts') as PlaygroundResponse<T>;
		}

		if (segments[2] === 'owner' && method === 'PATCH') {
			const alertId = segments[1];
			const alert = playgroundState.alerts.find((a) => a.id === alertId);
			if (!alert) return withError('Alert not found') as PlaygroundResponse<T>;
			const ownerId = (body as { ownerId: string | null } | undefined)?.ownerId ?? null;
			alert.ownerId = ownerId;
			return withSuccess<{ alert: Alert }>({ alert }) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'DELETE') {
			const alertId = segments[1];
			playgroundState.alerts = playgroundState.alerts.filter((a) => a.id !== alertId);
			return withSuccess<void>(undefined as T);
		}

		if (segments[1] === 'archived' && segments[3] === 'owner' && method === 'PATCH') {
			const alertId = segments[2];
			const alert = playgroundState.archivedAlerts.find((a) => a.id === alertId);
			if (!alert) return withError('Alert not found') as PlaygroundResponse<T>;
			const ownerId = (body as { ownerId: string | null } | undefined)?.ownerId ?? null;
			alert.ownerId = ownerId;
			return withSuccess<{ alert: Alert }>({ alert }) as PlaygroundResponse<T>;
		}

		if (segments[2] === 'history' && method === 'GET') {
			const alertId = segments[1];
			const now = Date.now();
			const history: AlertHistory = {
				alertId,
				data: Array.from({ length: 6 }).map((_, idx) => ({
					date: new Date(now - idx * 60 * 60 * 1000).toISOString(),
					status: idx % 2 === 0 ? AlertStatus.FIRING : AlertStatus.RESOLVED,
				})),
			};
			return withSuccess<AlertHistory>(history) as PlaygroundResponse<T>;
		}

		if (segments[1] === 'comments') {
			// Not expected pattern
			return withError('Unsupported comments route') as PlaygroundResponse<T>;
		}
	}

	// Alert comments
	if (segments[0] === 'alerts' && segments[2] === 'comments') {
		const alertId = segments[1];
		if (segments.length === 3 && method === 'GET') {
			const comments = playgroundState.alertComments.filter((c) => c.alertId === alertId);
			return withSuccess<{ comments: AlertComment[] }>({ comments }) as PlaygroundResponse<T>;
		}
		if (segments.length === 3 && method === 'POST') {
			const payload = body as { userId: string; comment: string };
			const newComment: AlertComment = {
				id: `comment-${randomId()}`,
				alertId,
				userId: payload.userId,
				comment: payload.comment,
				createdAt: nowIso(),
				updatedAt: nowIso(),
			};
			playgroundState.alertComments.push(newComment);
			return withSuccess<{ comment: AlertComment }>({ comment: newComment }) as PlaygroundResponse<T>;
		}
	}

	if (segments[0] === 'alerts' && segments[1] === 'comments' && segments.length === 3) {
		const commentId = segments[2];
		const comment = playgroundState.alertComments.find((c) => c.id === commentId);
		if (!comment) return withError('Comment not found') as PlaygroundResponse<T>;

		if (method === 'PATCH') {
			const payload = body as { comment: string };
			comment.comment = payload.comment;
			comment.updatedAt = nowIso();
			return withSuccess<{ comment: AlertComment }>({ comment }) as PlaygroundResponse<T>;
		}

		if (method === 'DELETE') {
			playgroundState.alertComments = playgroundState.alertComments.filter((c) => c.id !== commentId);
			return withSuccess<{ message: string }>({ message: 'Deleted' }) as PlaygroundResponse<T>;
		}
	}

	// Providers & Services
	if (segments[0] === 'providers') {
		if (segments.length === 1 && method === 'GET') {
			return withSuccess<{ providers: Provider[] }>({
				providers: playgroundState.providers,
			}) as PlaygroundResponse<T>;
		}

		if (segments.length === 1 && method === 'POST') {
			const payload = body as Provider;
			const newProvider: Provider = {
				...payload,
				id: randomId(),
				createdAt: nowIso(),
				providerType: payload.providerType as ProviderType,
			};
			playgroundState.providers.push(newProvider);
			return withSuccess<Provider>(newProvider) as PlaygroundResponse<T>;
		}

		if (segments[1] === 'bulk' && method === 'POST') {
			const payload = (body as { providers: Provider[] }).providers || [];
			const added = payload.map((provider) => {
				const newProvider: Provider = {
					...provider,
					id: randomId(),
					createdAt: nowIso(),
					providerType: provider.providerType as ProviderType,
				};
				playgroundState.providers.push(newProvider);
				return newProvider;
			});
			return withSuccess<{ success: true; providers: Provider[] }>({
				success: true,
				providers: added,
			}) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'GET') {
			const providerId = Number(segments[1]);
			const provider = findProvider(providerId);
			return provider ? withSuccess<Provider>(provider) : withError('Provider not found');
		}

		if (segments[2] === 'services' && method === 'GET') {
			const providerId = Number(segments[1]);
			const services = playgroundState.services.filter((s) => s.providerId === providerId);
			return withSuccess(services) as PlaygroundResponse<T>;
		}

		if (segments[2] === 'discover-services' && method === 'GET') {
			const discoveries = playgroundState.services.map((service) => ({
				name: service.name,
				serviceStatus: service.serviceStatus,
				serviceIP: service.serviceIP || '',
				namespace: service.containerDetails?.namespace,
			}));
			return withSuccess(discoveries) as PlaygroundResponse<T>;
		}

		if (segments[2] === 'instance' && segments[3] === 'bulk' && method === 'POST') {
			const providerId = Number(segments[1]);
			const names = ((body as { service_names: string[] })?.service_names || []).filter(Boolean);
			const provider = findProvider(providerId);
			if (!provider) return withError('Provider not found') as PlaygroundResponse<T>;
			const created = names.map((name) => {
				const newService: ServiceWithProvider = {
					id: randomId(),
					providerId,
					name,
					serviceStatus: 'running',
					serviceType: ServiceType.MANUAL,
					createdAt: nowIso(),
					provider,
					tags: [],
				};
				playgroundState.services.push(newService);
				return { id: String(newService.id), name: newService.name };
			});
			return withSuccess(created) as PlaygroundResponse<T>;
		}

		if (segments[1] === 'test-connection' && method === 'POST') {
			return withSuccess<{ isValidConnection: boolean }>({ isValidConnection: true }) as PlaygroundResponse<T>;
		}

		if (segments[2] === 'refresh' && method === 'POST') {
			const providerId = Number(segments[1]);
			const provider = findProvider(providerId);
			if (!provider) return withError('Provider not found') as PlaygroundResponse<T>;
			const services = playgroundState.services.filter((s) => s.providerId === providerId);
			return withSuccess<{ provider: Provider; services: ServiceWithProvider[] }>({
				provider,
				services,
			}) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'DELETE') {
			const providerId = Number(segments[1]);
			playgroundState.providers = playgroundState.providers.filter((p) => p.id !== providerId);
			playgroundState.services = playgroundState.services.filter((s) => s.providerId !== providerId);
			return withSuccess<void>(undefined as T);
		}

		if (segments.length === 2 && method === 'PUT') {
			const providerId = Number(segments[1]);
			const provider = findProvider(providerId);
			if (!provider) return withError('Provider not found') as PlaygroundResponse<T>;
			Object.assign(provider, body);
			return withSuccess<Provider>(provider) as PlaygroundResponse<T>;
		}
	}

	if (segments[0] === 'services') {
		if (segments.length === 1 && method === 'GET') {
			return withSuccess<ServiceWithProvider[]>(playgroundState.services) as PlaygroundResponse<T>;
		}

		if (segments.length === 1 && method === 'POST') {
			const payload = body as Partial<ServiceWithProvider>;
			const provider = payload.providerId ? findProvider(payload.providerId) : undefined;
			if (!provider) return withError('Provider not found') as PlaygroundResponse<T>;
			const newService: ServiceWithProvider = {
				id: randomId(),
				providerId: provider.id,
				name: payload.name || 'new-service',
				serviceIP: payload.serviceIP,
				serviceStatus: payload.serviceStatus || 'running',
				serviceType: (payload.serviceType as ServiceType) || ServiceType.MANUAL,
				createdAt: nowIso(),
				provider,
				containerDetails: payload.containerDetails,
				tags: [],
				customFields: {},
			};
			playgroundState.services.push(newService);
			return withSuccess<ServiceWithProvider>(newService) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'GET') {
			const serviceId = Number(segments[1]);
			const service = findService(serviceId);
			return service ? withSuccess<ServiceWithProvider>(service) : withError('Service not found');
		}

		if (segments.length === 2 && method === 'PUT') {
			const serviceId = Number(segments[1]);
			const service = findService(serviceId);
			if (!service) return withError('Service not found') as PlaygroundResponse<T>;
			Object.assign(service, body);
			return withSuccess<ServiceWithProvider>(service) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'DELETE') {
			const serviceId = Number(segments[1]);
			playgroundState.services = playgroundState.services.filter((s) => s.id !== serviceId);
			return withSuccess<void>(undefined as T);
		}

		if (segments[2] === 'start' && method === 'POST') {
			const serviceId = Number(segments[1]);
			const service = findService(serviceId);
			if (!service) return withError('Service not found') as PlaygroundResponse<T>;
			service.serviceStatus = 'running';
			return withSuccess<ServiceWithProvider>(service) as PlaygroundResponse<T>;
		}

		if (segments[2] === 'stop' && method === 'POST') {
			const serviceId = Number(segments[1]);
			const service = findService(serviceId);
			if (!service) return withError('Service not found') as PlaygroundResponse<T>;
			service.serviceStatus = 'stopped';
			return withSuccess<ServiceWithProvider>(service) as PlaygroundResponse<T>;
		}

		if (segments[2] === 'logs' && method === 'GET') {
			return withSuccess<string[]>([
				`[${new Date().toISOString()}] Starting service`,
				`[${new Date().toISOString()}] Service healthy`,
			]) as PlaygroundResponse<T>;
		}

		if (segments[2] === 'pods' && method === 'GET') {
			return withSuccess([{ name: 'pod-1' }, { name: 'pod-2' }]) as PlaygroundResponse<T>;
		}

		if (segments[2] === 'tags') {
			const serviceId = Number(segments[1]);
			const service = findService(serviceId);
			if (!service) return withError('Service not found') as PlaygroundResponse<T>;

			if (segments.length === 3 && method === 'GET') {
				return withSuccess<Tag[]>(service.tags || []) as PlaygroundResponse<T>;
			}

			if (segments.length === 3 && method === 'POST') {
				const tagId = (body as { tagId: number }).tagId;
				const tag = playgroundState.tags.find((t) => t.id === tagId);
				if (tag && !service.tags?.find((t) => t.id === tagId)) {
					service.tags = [...(service.tags || []), tag];
				}
				return withSuccess<{ message: string }>({ message: 'Tag added' }) as PlaygroundResponse<T>;
			}

			if (segments.length === 4 && method === 'DELETE') {
				const tagId = Number(segments[3]);
				service.tags = (service.tags || []).filter((t) => t.id !== tagId);
				return withSuccess<{ message: string }>({ message: 'Tag removed' }) as PlaygroundResponse<T>;
			}
		}
	}

	// Tags
	if (segments[0] === 'tags') {
		if (segments.length === 1 && method === 'GET') {
			return withSuccess<Tag[]>(playgroundState.tags) as PlaygroundResponse<T>;
		}

		if (segments.length === 1 && method === 'POST') {
			const payload = body as { name: string; color: string };
			const newTag: Tag = { ...payload, id: randomId(), createdAt: nowIso() };
			playgroundState.tags.push(newTag);
			return withSuccess<Tag>(newTag) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'GET') {
			const tagId = Number(segments[1]);
			const tag = playgroundState.tags.find((t) => t.id === tagId);
			return tag ? withSuccess<Tag>(tag) : withError('Tag not found');
		}

		if (segments.length === 2 && method === 'PUT') {
			const tagId = Number(segments[1]);
			const tag = playgroundState.tags.find((t) => t.id === tagId);
			if (!tag) return withError('Tag not found') as PlaygroundResponse<T>;
			Object.assign(tag, body);
			return withSuccess<Tag>(tag) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'DELETE') {
			const tagId = Number(segments[1]);
			playgroundState.tags = playgroundState.tags.filter((t) => t.id !== tagId);
			playgroundState.services = playgroundState.services.map((svc) => ({
				...svc,
				tags: (svc.tags || []).filter((t) => t.id !== tagId),
			}));
			return withSuccess<void>(undefined as T);
		}
	}

	// Integrations
	if (segments[0] === 'integrations') {
		if (segments.length === 1 && method === 'GET') {
			return withSuccess<{ integrations: Integration[] }>({
				integrations: playgroundState.integrations,
			}) as PlaygroundResponse<T>;
		}

		if (segments.length === 1 && method === 'POST') {
			const payload = body as Integration;
			const newIntegration: Integration = {
				...payload,
				id: randomId(),
				createdAt: nowIso(),
			};
			playgroundState.integrations.push(newIntegration);
			return withSuccess<Integration>(newIntegration) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'PUT') {
			const integrationId = Number(segments[1]);
			const integration = playgroundState.integrations.find((i) => i.id === integrationId);
			if (!integration) return withError('Integration not found') as PlaygroundResponse<T>;
			Object.assign(integration, body);
			return withSuccess<Integration>(integration) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'DELETE') {
			const integrationId = Number(segments[1]);
			playgroundState.integrations = playgroundState.integrations.filter((i) => i.id !== integrationId);
			return withSuccess<{ message: string }>({ message: 'Integration deleted' }) as PlaygroundResponse<T>;
		}

		if (segments.length === 3 && segments[2] === 'urls' && method === 'GET') {
			const urls = playgroundState.tags.map((tag) => ({
				name: `Webhook for ${tag.name}`,
				url: `https://hooks.opsimate.local/${tag.name}`,
			}));
			return withSuccess(urls) as PlaygroundResponse<T>;
		}
	}

	// Dashboards
	if (segments[0] === 'dashboards') {
		if (segments.length === 1 && method === 'GET') {
			return withSuccess<Dashboard[]>(playgroundState.dashboards) as PlaygroundResponse<T>;
		}

		if (segments.length === 1 && method === 'POST') {
			const payload = body as Dashboard;
			const newDashboard: Dashboard = {
				...payload,
				id: `d-${randomId()}`,
				createdAt: nowIso(),
			};
			playgroundState.dashboards.push(newDashboard);
			return withSuccess<{ id: string }>({ id: newDashboard.id }) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'PUT') {
			const dashboardId = segments[1];
			const dashboard = playgroundState.dashboards.find((d) => d.id === dashboardId);
			if (!dashboard) return withError('Dashboard not found') as PlaygroundResponse<T>;
			Object.assign(dashboard, body);
			return withSuccess<Dashboard>(dashboard) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'DELETE') {
			const dashboardId = segments[1];
			playgroundState.dashboards = playgroundState.dashboards.filter((d) => d.id !== dashboardId);
			return withSuccess<void>(undefined as T);
		}

		if (segments[1] === 'tags' && segments.length === 2 && method === 'GET') {
			const response = playgroundState.dashboards.map((d) => ({
				dashboardId: Number.isNaN(Number(d.id)) ? 0 : Number(d.id),
				tags: (playgroundState.dashboardTags[d.id] || []).map(
					(tagId) => playgroundState.tags.find((t) => t.id === tagId)!
				),
			}));
			return withSuccess(response) as PlaygroundResponse<T>;
		}

		if (segments.length === 3 && segments[2] === 'tags' && method === 'GET') {
			const dashboardId = segments[1];
			const tags = (playgroundState.dashboardTags[dashboardId] || [])
				.map((tagId) => playgroundState.tags.find((t) => t.id === tagId))
				.filter(Boolean) as Tag[];
			return withSuccess<Tag[]>(tags) as PlaygroundResponse<T>;
		}

		if (segments.length === 3 && segments[2] === 'tags' && method === 'POST') {
			const dashboardId = segments[1];
			const tagId = (body as { tagId: number }).tagId;
			const existing = playgroundState.dashboardTags[dashboardId] || [];
			if (!existing.includes(tagId)) {
				playgroundState.dashboardTags[dashboardId] = [...existing, tagId];
			}
			return withSuccess<void>(undefined as T);
		}

		if (segments.length === 4 && segments[2] === 'tags' && method === 'DELETE') {
			const dashboardId = segments[1];
			const tagId = Number(segments[3]);
			playgroundState.dashboardTags[dashboardId] = (playgroundState.dashboardTags[dashboardId] || []).filter(
				(id) => id !== tagId
			);
			return withSuccess<void>(undefined as T);
		}
	}

	// Views
	if (segments[0] === 'views') {
		if (segments.length === 1 && method === 'GET') {
			return withSuccess<SavedView[]>(playgroundState.views) as PlaygroundResponse<T>;
		}

		if (segments.length === 1 && method === 'POST') {
			const payload = body as SavedView;
			const newView: SavedView = {
				...payload,
				id: payload.id || `v-${randomId()}`,
				createdAt: payload.createdAt || nowIso(),
			};
			playgroundState.views.push(newView);
			return withSuccess<SavedView>(newView) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'GET') {
			const view = playgroundState.views.find((v) => v.id === segments[1]);
			return view ? withSuccess<SavedView>(view) : withError('View not found');
		}

		if (segments[1] === 'active' && method === 'GET') {
			return withSuccess<{ activeViewId: string | null }>({
				activeViewId: playgroundState.activeViewId,
			}) as PlaygroundResponse<T>;
		}

		if (segments[1] === 'active' && method === 'POST') {
			playgroundState.activeViewId = (body as { viewId: string }).viewId;
			return withSuccess<{ message: string }>({ message: 'Active view updated' }) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'DELETE') {
			const viewId = segments[1];
			playgroundState.views = playgroundState.views.filter((v) => v.id !== viewId);
			return withSuccess<{ message: string }>({ message: 'View deleted' }) as PlaygroundResponse<T>;
		}
	}

	// Users
	if (segments[0] === 'users') {
		if (segments[1] === 'exists' && method === 'GET') {
			return withSuccess<{ exists: boolean }>({ exists: true }) as PlaygroundResponse<T>;
		}

		if (segments[1] === 'login' && method === 'POST') {
			return withSuccess<{ token: string; data: { user: User } }>({
				token: 'playground-token',
				data: { user: getPlaygroundUser() },
			}) as PlaygroundResponse<T>;
		}

		if (segments[1] === 'register' && method === 'POST') {
			const payload = body as Partial<User>;
			const newUser: User = {
				id: String(randomId()),
				email: payload.email || `user${randomId()}@opsimate.local`,
				fullName: payload.fullName || 'New Playground User',
				role: (payload.role as Role) || Role.Viewer,
				createdAt: nowIso(),
			};
			playgroundState.users.push(newUser);
			return withSuccess<{ token: string; data: { user: User } }>({
				token: 'playground-token',
				data: { user: newUser },
			}) as PlaygroundResponse<T>;
		}

		if (segments[1] === 'forgot-password' && method === 'POST') {
			return withSuccess<{ data: { id: string; email: string } }>({
				data: { id: getPlaygroundUser().id, email: getPlaygroundUser().email },
			}) as PlaygroundResponse<T>;
		}

		if (segments[1] === 'validate-reset-password-token' && method === 'POST') {
			return withSuccess<{ success: boolean; message: string }>({
				success: true,
				message: 'Token valid in playground',
			}) as PlaygroundResponse<T>;
		}

		if (segments[1] === 'reset-password' && method === 'POST') {
			return withSuccess<{ data: { id: string; email: string } }>({
				data: { id: getPlaygroundUser().id, email: getPlaygroundUser().email },
			}) as PlaygroundResponse<T>;
		}

		if (segments.length === 1 && method === 'GET') {
			return withSuccess<User[]>(playgroundState.users) as PlaygroundResponse<T>;
		}
	}

	// Audit logs
	if (segments[0] === 'audit' && method === 'GET') {
		return withSuccess<{ logs: AuditLog[]; total: number }>({
			logs: playgroundState.auditLogs,
			total: playgroundState.auditLogs.length,
		}) as PlaygroundResponse<T>;
	}

	// Custom actions
	if (segments[0] === 'custom-actions') {
		if (segments.length === 1 && method === 'GET') {
			return withSuccess<{ actions: CustomAction[] }>({
				actions: playgroundState.customActions,
			}) as PlaygroundResponse<T>;
		}

		if (segments.length === 1 && method === 'POST') {
			const payload = body as CustomAction;
			const newAction: CustomAction = { ...payload, id: randomId() };
			playgroundState.customActions.push(newAction);
			return withSuccess<{ id: number }>({ id: newAction.id }) as PlaygroundResponse<T>;
		}

		if (segments.length === 2 && method === 'PUT') {
			const actionId = Number(segments[1]);
			const action = playgroundState.customActions.find((a) => a.id === actionId);
			if (!action) return withError('Action not found') as PlaygroundResponse<T>;
			Object.assign(action, body);
			return withSuccess<void>(undefined as T);
		}

		if (segments.length === 2 && method === 'DELETE') {
			const actionId = Number(segments[1]);
			playgroundState.customActions = playgroundState.customActions.filter((a) => a.id !== actionId);
			return withSuccess<void>(undefined as T);
		}

		if (segments[1] === 'run' && method === 'POST') {
			return withSuccess<void>(undefined as T);
		}
	}

	return withError('Playground endpoint not implemented') as PlaygroundResponse<T>;
};
