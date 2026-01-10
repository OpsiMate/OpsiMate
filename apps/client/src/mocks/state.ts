import { getPlaygroundUser } from '@/lib/playground';
import { SavedView } from '@/types/SavedView';
import { CustomAction } from '@OpsiMate/custom-actions';
import {
	Alert,
	AlertComment,
	AlertStatus,
	AuditActionType,
	AuditLog,
	AuditResourceType,
	Dashboard,
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
import { generateDiverseMockAlerts } from './mockAlerts.utils';

export { getPlaygroundUser };

export interface PlaygroundState {
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
}

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
		id: 1,
		name: 'Grafana Prod',
		type: IntegrationType.Grafana,
		externalUrl: 'https://grafana.example.com',
		credentials: { apiKey: 'demo-api-key' },
		createdAt: nowIso(),
	},
	{
		id: 3,
		name: 'Datadog APM',
		type: IntegrationType.Datadog,
		externalUrl: 'https://app.datadoghq.com',
		credentials: { apiKey: 'demo-dd-api', appKey: 'demo-dd-app' },
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
	const alerts = generateDiverseMockAlerts(500);
	return alerts.map((alert, idx) => ({
		...alert,
		ownerId: idx % 7 === 0 ? getPlaygroundUser().id : null,
	}));
};

const createArchivedAlerts = (alerts: Alert[]) =>
	alerts.slice(0, 20).map((alert, index) => ({
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

export const playgroundState: PlaygroundState = {
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
	dashboardTags: { '101': [1, 5], '102': [1, 2, 3] },
	views: createViews(),
	activeViewId: 'v-1',
	users: createUsers(),
	customActions: createCustomActions(),
	auditLogs: createAuditLogs(),
};

let idCounter = 10000;
export const randomId = () => idCounter++;
