import { vi } from 'vitest';
import Database from 'better-sqlite3';
import { createApp, AppMode } from '../src/app.ts';
import request, { SuperTest, Test } from 'supertest';
import { DashboardRepository } from '../src/dal/dashboardRepository.ts';
import { TagRepository } from '../src/dal/tagRepository.ts';
import { IntegrationRepository } from '../src/dal/integrationRepository.ts';
import { AlertRepository } from '../src/dal/alertRepository.ts';
import { UserRepository } from '../src/dal/userRepository.ts';
import { AuditLogRepository } from '../src/dal/auditLogRepository.ts';
import { SecretsMetadataRepository } from '../src/dal/secretsMetadataRepository.ts';
import { ServiceCustomFieldRepository } from '../src/dal/serviceCustomFieldRepository.ts';
import { PasswordResetsRepository } from '../src/dal/passwordResetsRepository.ts';
import { ResolvedAlertRepository } from '../src/dal/resolvedAlertRepository.ts';

// Increase timeout for integration tests
vi.setConfig({ testTimeout: 30000 });

// Existing tests seed the DB directly (db.exec) and expect the next request to see it —
// a TTL'd snapshot cache would serve them stale data. 0 disables caching while keeping
// the snapshot/ETag shape; cache behaviour itself is covered by snapshotCache.test.ts
// and alertsSnapshotCache.test.ts, which construct their own TTLs. Must be set before
// app.ts (and its AlertBL) is imported, which the import above already guarantees only
// for module-eval order — so keep this line ahead of any setup*() call.
process.env.ALERTS_SNAPSHOT_TTL_MS = '0';

export async function setupDB(): Promise<Database.Database> {
	const db = new Database(':memory:');
	const dashboardRepo = new DashboardRepository(db);
	const tagRepo = new TagRepository(db);
	const integrationRepo = new IntegrationRepository(db);
	const alertRepo = new AlertRepository(db);
	const resolvedAlertRepo = new ResolvedAlertRepository(db);
	const userRepo = new UserRepository(db);
	const auditLogRepo = new AuditLogRepository(db);
	const secretsMetadataRepo = new SecretsMetadataRepository(db);
	const serviceCustomFieldRepo = new ServiceCustomFieldRepository(db);
	const passwordResetsRepo = new PasswordResetsRepository(db);

	// Init tables
	await Promise.all([
		dashboardRepo.initDashboardTable(),
		tagRepo.initTagsTables(),
		integrationRepo.initIntegrationsTable(),
		resolvedAlertRepo.initResolvedAlertsTable(), // should be prior to alertRepo.initAlertsTable()
		alertRepo.initAlertsTable(),
		userRepo.initUsersTable(),
		auditLogRepo.initAuditLogsTable(),
		secretsMetadataRepo.initSecretsMetadataTable(),
		serviceCustomFieldRepo.initServiceCustomFieldTable(),
		passwordResetsRepo.initPasswordResetsTable(),
	]);
	return db;
}

export async function setupExpressApp(db: Database.Database): Promise<SuperTest<Test>> {
	const expressApp = await createApp(db, AppMode.SERVER);
	if (!expressApp) {
		throw new Error('Failed to create Express app in test setup');
	}
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
