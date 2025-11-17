import express from 'express';
import cors from 'cors';
import healthRouter from './api/health';
import createV1Router from './api/v1/v1';
import { ProviderRepository } from './dal/providerRepository';
import { ServiceRepository } from './dal/serviceRepository';
import { ViewRepository } from './dal/viewRepository';
import { TagRepository } from './dal/tagRepository';
import { IntegrationRepository } from './dal/integrationRepository';
import { AlertRepository } from './dal/alertRepository';
import { ProviderBL } from './bl/providers/provider.bl';
import { ViewBL } from './bl/custom-views/custom-view.bl';
import { IntegrationBL } from './bl/integrations/integration.bl';
import { AlertBL } from './bl/alerts/alert.bl';
import { ProviderController } from './api/v1/providers/controller';
import { ServiceController } from './api/v1/services/controller';
import { ViewController } from './api/v1/views/controller';
import { TagController } from './api/v1/tags/controller';
import { IntegrationController } from './api/v1/integrations/controller';
import { AlertController } from './api/v1/alerts/controller';
import { UserRepository } from './dal/userRepository';
import { UserBL } from './bl/users/user.bl';
import { UsersController } from './api/v1/users/controller';
import Database from 'better-sqlite3';
import { RefreshJob } from './jobs/refresh-job';
import { PullGrafanaAlertsJob } from './jobs/pull-grafana-alerts-job';
import { AuditLogRepository } from './dal/auditLogRepository';
import { AuditBL } from './bl/audit/audit.bl';
import { AuditController } from './api/v1/audit/controller';
import { SecretsController } from './api/v1/secrets/controller';
import { SecretsMetadataBL } from './bl/secrets/secretsMetadata.bl';
import { SecretsMetadataRepository } from './dal/secretsMetadataRepository';
import { ServiceCustomFieldRepository } from './dal/serviceCustomFieldRepository';
import { ServiceCustomFieldValueRepository } from './dal/serviceCustomFieldValueRepository';
import { ServiceCustomFieldBL } from './bl/custom-fields/serviceCustomField.bl';
import { CustomFieldsController } from './api/v1/custom-fields/controller';
import { ServicesBL } from './bl/services/services.bl';
import { PasswordResetsRepository } from './dal/passwordResetsRepository';
import { MailClient } from './dal/external-client/mail-client';
import { CustomActionRepository } from './dal/customActionRepository';
import { CustomActionBL } from './bl/custom-actions/customAction.bl';
import { CustomActionsController } from './api/v1/custom-actions/controller';

export async function createApp(db: Database.Database, config?: { enableJobs: boolean }): Promise<express.Application> {
	const app = express();

	app.use(express.json());

	app.use(
		cors({
			origin: (origin, callback) => {
				// allow requests with no origin (like curl or mobile apps)
				if (!origin) return callback(null, true);
				return callback(null, origin);
			},
			credentials: true,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
			allowedHeaders: ['Content-Type', 'Authorization'],
		})
	);

	// Repositories
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

	// Initialize Mail Service
	const mailClient = new MailClient();
	await mailClient.initialize();

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

	// BL
	const auditBL = new AuditBL(auditLogRepo);
	const providerBL = new ProviderBL(providerRepo, serviceRepo, secretsMetadataRepo, auditBL);
	const alertBL = new AlertBL(alertRepo);
	const integrationBL = new IntegrationBL(integrationRepo, alertBL);
	const userBL = new UserBL(userRepo, mailClient, passwordResetsRepo, auditBL);
	const secretMetadataBL = new SecretsMetadataBL(secretsMetadataRepo, auditBL);
	const serviceCustomFieldBL = new ServiceCustomFieldBL(serviceCustomFieldRepo, serviceCustomFieldValueRepo);
	const servicesBL = new ServicesBL(serviceRepo, auditBL);
	const customActionBL = new CustomActionBL(customActionRepo, providerBL, servicesBL, serviceCustomFieldBL);

	// Controllers
	const providerController = new ProviderController(providerBL, secretsMetadataRepo);
	const serviceController = new ServiceController(
		providerRepo,
		serviceRepo,
		servicesBL,
		serviceCustomFieldBL,
		tagRepo,
		alertBL
	);
	const viewController = new ViewController(new ViewBL(viewRepo));
	const tagController = new TagController(tagRepo, serviceRepo, alertBL);
	const integrationController = new IntegrationController(integrationBL);
	const alertController = new AlertController(alertBL);
	const usersController = new UsersController(userBL);
	const auditController = new AuditController(auditBL);
	const secretController = new SecretsController(secretMetadataBL);
	const customFieldsController = new CustomFieldsController(serviceCustomFieldBL);
	const customActionsController = new CustomActionsController(customActionBL);

	app.use('/', healthRouter);
	app.use(
		'/api/v1',
		createV1Router(
			providerController,
			serviceController,
			viewController,
			tagController,
			integrationController,
			alertController,
			usersController,
			auditController,
			secretController,
			customFieldsController,
			customActionsController
		)
	);

	if (config?.enableJobs) {
		new RefreshJob(providerBL).startRefreshJob();
		new PullGrafanaAlertsJob(alertBL, integrationBL).startPullGrafanaAlertsJob();
	}

	return app;
}
