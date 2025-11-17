import { vi } from 'vitest';
import Database from 'better-sqlite3';
import { createApp } from '../src/app.ts';
import request, { SuperTest, Test } from 'supertest';
import { ProviderRepository } from '../src/dal/providerRepository.ts';
import { ServiceRepository } from '../src/dal/serviceRepository.ts';
import { ViewRepository } from '../src/dal/viewRepository.ts';
import { TagRepository } from '../src/dal/tagRepository.ts';
import { IntegrationRepository } from '../src/dal/integrationRepository.ts';
import { AlertRepository } from '../src/dal/alertRepository.ts';
import { UserRepository } from '../src/dal/userRepository.ts';
import { AuditLogRepository } from '../src/dal/auditLogRepository.ts';
import { SecretsMetadataRepository } from '../src/dal/secretsMetadataRepository.ts';
import { ServiceCustomFieldRepository } from '../src/dal/serviceCustomFieldRepository.ts';
import { ServiceCustomFieldValueRepository } from '../src/dal/serviceCustomFieldValueRepository.ts';
import { PasswordResetsRepository } from '../src/dal/passwordResetsRepository.ts';
import { CustomActionRepository } from '../src/dal/customActionRepository.ts';

// Mock the Kubernetes client to avoid ES module issues
vi.mock('@kubernetes/client-node', () => ({
	KubeConfig: vi.fn().mockImplementation(() => ({
		loadFromDefault: vi.fn(),
		loadFromFile: vi.fn(),
		makeApiClient: vi.fn(),
	})),
	CoreV1Api: vi.fn(),
	AppsV1Api: vi.fn(),
	NetworkingV1Api: vi.fn(),
}));

// Mock the SSH client to avoid actual SSH connections in tests
vi.mock('../src/dal/sshClient', async () => {
	const actual = await vi.importActual('../src/dal/sshClient');
	return {
		...actual,
		executeBashScript: vi.fn().mockResolvedValue({
			code: 0,
			stdout: 'mocked output',
			stderr: '',
			signal: null,
		}),
		testConnection: vi.fn().mockResolvedValue({ success: true }),
		connectAndListContainers: vi.fn().mockResolvedValue([]),
		startService: vi.fn().mockResolvedValue(undefined),
		stopService: vi.fn().mockResolvedValue(undefined),
		getServiceLogs: vi.fn().mockResolvedValue(['mocked log']),
		startSystemService: vi.fn().mockResolvedValue(undefined),
		stopSystemService: vi.fn().mockResolvedValue(undefined),
		getSystemServiceLogs: vi.fn().mockResolvedValue(['mocked system log']),
		checkSystemServiceStatus: vi.fn().mockResolvedValue('running'),
	};
});

// Increase timeout for integration tests
vi.setConfig({ testTimeout: 30000 });

export async function setupDB(): Promise<Database.Database> {
	const db = new Database(':memory:');
	const providerRepo = new ProviderRepository(db);
	const serviceRepo = new ServiceRepository(db);
	const viewRepo = new ViewRepository(db);
	const tagRepo = new TagRepository(db);
	const integrationRepo = new IntegrationRepository(db);
	const alertRepo = new AlertRepository(db);
	const userRepo = new UserRepository(db);
	const auditLogRepo = new AuditLogRepository(db);
	const secretsMetadataRepo = new SecretsMetadataRepository(db);
	const serviceCustomFieldRepo = new ServiceCustomFieldRepository(db);
	const serviceCustomFieldValueRepo = new ServiceCustomFieldValueRepository(db);
	const passwordResetsRepo = new PasswordResetsRepository(db);
	const customActionRepo = new CustomActionRepository(db);

	// Init tables
	await Promise.all([
		providerRepo.initProvidersTable(),
		serviceRepo.initServicesTable(),
		viewRepo.initViewsTable(),
		tagRepo.initTagsTables(),
		integrationRepo.initIntegrationsTable(),
		alertRepo.initAlertsTable(),
		userRepo.initUsersTable(),
		auditLogRepo.initAuditLogsTable(),
		secretsMetadataRepo.initSecretsMetadataTable(),
		serviceCustomFieldRepo.initServiceCustomFieldTable(),
		serviceCustomFieldValueRepo.initServiceCustomFieldValueTable(),
		passwordResetsRepo.initPasswordResetsTable(),
		customActionRepo.initCustomActionsTable(),
	]);
	return db;
}

export async function setupExpressApp(db: Database.Database): Promise<SuperTest<Test>> {
	const expressApp = await createApp(db);
	return request(expressApp) as unknown as SuperTest<Test>;
}

export async function setupUserWithToken(app: SuperTest<Test>): Promise<string> {
	// Register and login a user to get a JWT token
	const registerRes = await app.post('/api/v1/users/register').send({
		email: 'provideruser@example.com',
		fullName: 'Provider User',
		password: 'testpassword',
	});

	if (registerRes.status !== 201) {
		throw new Error(`Registration failed: ${registerRes.status} ${JSON.stringify(registerRes.body)}`);
	}

	const loginRes = await app.post('/api/v1/users/login').send({
		email: 'provideruser@example.com',
		password: 'testpassword',
	});

	if (loginRes.status !== 200 || !loginRes.body.token) {
		throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
	}

	return loginRes.body.token as string;
}
