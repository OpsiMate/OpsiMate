import Database from 'better-sqlite3';
import cors from 'cors';
import express from 'express';
import healthRouter from './api/health';
import { ActionController } from './api/v1/actions/controller';
import { AlertController } from './api/v1/alerts/controller';
import { AuditController } from './api/v1/audit/controller';
import { RetentionController } from './api/v1/retention/controller';
import { CustomActionsController } from './api/v1/custom-actions/controller';
import { CustomFieldsController } from './api/v1/custom-fields/controller';
import { DashboardController } from './api/v1/dashboards/controller';
import { IntegrationController } from './api/v1/integrations/controller';
import { PlaygroundController } from './api/v1/playground/controller';
import { ProviderController } from './api/v1/providers/controller';
import { SecretsController } from './api/v1/secrets/controller';
import { ServiceController } from './api/v1/services/controller';
import { EnrichmentController } from './api/v1/enrichments/controller';
import { MutePolicyController } from './api/v1/mute-policies/controller';
import { OncallController } from './api/v1/oncall/controller';
import { TagController } from './api/v1/tags/controller';
import { UsersController } from './api/v1/users/controller';
import createV1Router from './api/v1/v1';
import { ActionBL } from './bl/actions/action.bl';
import { AlertBL } from './bl/alerts/alert.bl';
import { AuditBL } from './bl/audit/audit.bl';
import { CustomActionBL } from './bl/custom-actions/customAction.bl';
import { ServiceCustomFieldBL } from './bl/custom-fields/serviceCustomField.bl';
import { DashboardBL } from './bl/dashboards/dashboard.bl.ts';
import { IntegrationBL } from './bl/integrations/integration.bl';
import { ProviderBL } from './bl/providers/provider.bl';
import { SecretsMetadataBL } from './bl/secrets/secretsMetadata.bl';
import { ServicesBL } from './bl/services/services.bl';
import { EnrichmentBL } from './bl/enrichments/enrichment.bl';
import { MutePolicyBL } from './bl/mute-policies/mutePolicy.bl';
import { OncallBL } from './bl/oncall/oncall.bl';
import { TagBL } from './bl/tags/tag.bl';
import { UserBL } from './bl/users/user.bl';
import { ActionRepository } from './dal/actionRepository';
import { AlertCommentsRepository } from './dal/alertCommentsRepository.ts';
import { AlertHistoryRepository } from './dal/alertHistoryRepository';
import { AlertRepository } from './dal/alertRepository';
import { ResolvedAlertRepository } from './dal/resolvedAlertRepository';
import { RetentionRepository } from './dal/retentionRepository';
import { AuditLogRepository } from './dal/auditLogRepository';
import { CustomActionRepository } from './dal/customActionRepository';
import { DashboardRepository } from './dal/dashboardRepository.ts';
import { MailClient } from './dal/external-client/mail-client';
import { IntegrationRepository } from './dal/integrationRepository';
import { PasswordResetsRepository } from './dal/passwordResetsRepository';
import { ProviderRepository } from './dal/providerRepository';
import { SecretsMetadataRepository } from './dal/secretsMetadataRepository';
import { ServiceCustomFieldRepository } from './dal/serviceCustomFieldRepository';
import { ServiceCustomFieldValueRepository } from './dal/serviceCustomFieldValueRepository';
import { ServiceRepository } from './dal/serviceRepository';
import { EnrichmentRepository } from './dal/enrichmentRepository';
import { MutePolicyRepository } from './dal/mutePolicyRepository';
import { OncallRepository } from './dal/oncallRepository';
import { TagRepository } from './dal/tagRepository';
import { UserRepository } from './dal/userRepository';
import { RefreshJob } from './jobs/refresh-job';
import { RetentionJob } from './jobs/retention-job';
import { RetentionBL } from './bl/retention/retention.bl';
import { PlaygroundRepository } from './dal/playgroundRepository.ts';
import { PlaygroundBL } from './bl/playground/playground.bl.ts';

export enum AppMode {
	SERVER = 'SERVER',
	WORKER = 'WORKER',
}

export async function createApp(db: Database.Database, mode: AppMode): Promise<express.Application | void> {
	// Repositories (needed by both SERVER and WORKER)
	const providerRepo = new ProviderRepository(db);
	const serviceRepo = new ServiceRepository(db);
	const integrationRepo = new IntegrationRepository(db);
	const alertRepo = new AlertRepository(db);
	const alertCommentsRepo = new AlertCommentsRepository(db);
	const auditLogRepo = new AuditLogRepository(db);
	const secretsMetadataRepo = new SecretsMetadataRepository(db);
	const resolvedAlertRepo = new ResolvedAlertRepository(db);
	const alertHistoryRepo = new AlertHistoryRepository(db);
	const retentionRepo = new RetentionRepository(db);
	// Needed by AlertBL (to resolve owner names for history); constructed here so it is also
	// available in WORKER mode where AlertBL is used.
	const userRepo = new UserRepository(db);

	// Init tables (needed by both)
	await Promise.all([
		providerRepo.initProvidersTable(),
		serviceRepo.initServicesTable(),
		integrationRepo.initIntegrationsTable(),
		resolvedAlertRepo.initResolvedAlertsTable(), // this should be prior to alertRepo.initAlertsTable
		alertRepo.initAlertsTable(),
		alertCommentsRepo.initAlertCommentsTable(),
		alertHistoryRepo.initAlertHistoryEventsTable(),
		auditLogRepo.initAuditLogsTable(),
		secretsMetadataRepo.initSecretsMetadataTable(),
		retentionRepo.initRetentionTables(),
	]);

	// BL (needed by both)
	const auditBL = new AuditBL(auditLogRepo);
	const providerBL = new ProviderBL(providerRepo, serviceRepo, secretsMetadataRepo, auditBL);
	const alertBL = new AlertBL(alertRepo, resolvedAlertRepo, alertCommentsRepo, alertHistoryRepo, userRepo);
	const integrationBL = new IntegrationBL(integrationRepo, alertBL);
	const retentionBL = new RetentionBL(retentionRepo);

	if (mode === AppMode.WORKER) {
		// WORKER mode: Only start background jobs.
		// Grafana alerts are now received via webhook (POST /alerts/custom/grafana) instead of
		// being polled, so the PullGrafanaAlertsJob is no longer started here.
		new RefreshJob(providerBL).startRefreshJob();
		new RetentionJob(retentionBL).startRetentionJob();
		return;
	}

	// SERVER mode: Create Express app and API routes
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

	// Additional repositories (only needed for SERVER)
	const dashboardRepository = new DashboardRepository(db);
	const tagRepo = new TagRepository(db);
	const serviceCustomFieldRepo = new ServiceCustomFieldRepository(db);
	const serviceCustomFieldValueRepo = new ServiceCustomFieldValueRepository(db);
	const passwordResetsRepo = new PasswordResetsRepository(db);
	const customActionRepo = new CustomActionRepository(db);
	const playgroundRepo = new PlaygroundRepository(db);
	const mutePolicyRepo = new MutePolicyRepository(db);
	const oncallRepo = new OncallRepository(db);
	const enrichmentRepo = new EnrichmentRepository(db);
	const actionRepo = new ActionRepository(db);

	// Initialize Mail Service
	const mailClient = new MailClient();
	await mailClient.initialize();

	// Init additional tables (only for SERVER)
	await Promise.all([
		dashboardRepository.initDashboardTable(),
		tagRepo.initTagsTables(),
		userRepo.initUsersTable(),
		serviceCustomFieldRepo.initServiceCustomFieldTable(),
		serviceCustomFieldValueRepo.initServiceCustomFieldValueTable(),
		passwordResetsRepo.initPasswordResetsTable(),
		customActionRepo.initCustomActionsTable(),
		playgroundRepo.initPlaygroundTable(),
		mutePolicyRepo.initMutePoliciesTable(),
		oncallRepo.initOncallTables(),
		enrichmentRepo.initEnrichmentsTable(),
		actionRepo.initActionsTable(),
	]);

	// BL
	const userBL = new UserBL(userRepo, mailClient, passwordResetsRepo, auditBL);
	const secretMetadataBL = new SecretsMetadataBL(secretsMetadataRepo, auditBL);
	const serviceCustomFieldBL = new ServiceCustomFieldBL(serviceCustomFieldRepo, serviceCustomFieldValueRepo);
	const servicesBL = new ServicesBL(serviceRepo, auditBL);
	const customActionBL = new CustomActionBL(customActionRepo, providerBL, servicesBL, serviceCustomFieldBL);
	const tagBL = new TagBL(tagRepo);
	const dashboardBL = new DashboardBL(dashboardRepository, auditBL, tagBL);
	const playgroundBL = new PlaygroundBL(playgroundRepo, mailClient);
	const mutePolicyBL = new MutePolicyBL(mutePolicyRepo);
	const oncallBL = new OncallBL(oncallRepo);
	alertBL.setMutePolicyBL(mutePolicyBL);
	const enrichmentBL = new EnrichmentBL(enrichmentRepo, auditBL);
	alertBL.setEnrichmentBL(enrichmentBL);
	const actionBL = new ActionBL(actionRepo, alertHistoryRepo);

	// Controllers (only for SERVER)
	const providerController = new ProviderController(providerBL, secretsMetadataRepo);
	const serviceController = new ServiceController(
		providerRepo,
		serviceRepo,
		servicesBL,
		serviceCustomFieldBL,
		tagRepo,
		alertBL
	);
	const dashboardController = new DashboardController(dashboardBL);
	const tagController = new TagController(tagRepo, serviceRepo);
	const integrationController = new IntegrationController(integrationBL);
	const alertController = new AlertController(alertBL);
	const usersController = new UsersController(userBL);
	const auditController = new AuditController(auditBL);
	const secretController = new SecretsController(secretMetadataBL);
	const customFieldsController = new CustomFieldsController(serviceCustomFieldBL);
	const customActionsController = new CustomActionsController(customActionBL);
	const playgroundController = new PlaygroundController(playgroundBL);
	const mutePolicyController = new MutePolicyController(mutePolicyBL);
	const oncallController = new OncallController(oncallBL);
	const enrichmentController = new EnrichmentController(enrichmentBL);
	const actionController = new ActionController(actionBL);
	const retentionController = new RetentionController(retentionBL);

	// Routes (only for SERVER)
	app.use('/', healthRouter);
	app.use(
		'/api/v1',
		createV1Router(
			providerController,
			serviceController,
			dashboardController,
			tagController,
			integrationController,
			alertController,
			usersController,
			auditController,
			secretController,
			customFieldsController,
			customActionsController,
			playgroundController,
			mutePolicyController,
			enrichmentController,
			actionController,
			retentionController,
			oncallController
		)
	);

	return app;
}
