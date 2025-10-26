import express from 'express';
import cors from 'cors';
import healthRouter from './api/health.js';
import createV1Router from './api/v1/v1.js';
import {ProviderRepository} from './dal/providerRepository.js';
import {ServiceRepository} from './dal/serviceRepository.js';
import {ViewRepository} from './dal/viewRepository.js';
import {TagRepository} from './dal/tagRepository.js';
import {IntegrationRepository} from './dal/integrationRepository.js';
import {AlertRepository} from './dal/alertRepository.js';
import {ProviderBL} from './bl/providers/provider.bl.js';
import {ViewBL} from './bl/custom-views/custom-view.bl.js';
import {IntegrationBL} from './bl/integrations/integration.bl.js';
import {AlertBL} from './bl/alerts/alert.bl.js';
import {ProviderController} from './api/v1/providers/controller.js';
import {ServiceController} from './api/v1/services/controller.js';
import {ViewController} from './api/v1/views/controller.js';
import {TagController} from './api/v1/tags/controller.js';
import {IntegrationController} from './api/v1/integrations/controller.js';
import {AlertController} from './api/v1/alerts/controller.js';
import {UserRepository} from './dal/userRepository.js';
import {UserBL} from './bl/users/user.bl.js';
import {UsersController} from './api/v1/users/controller.js';
import Database from "better-sqlite3";
import {RefreshJob} from "./jobs/refresh-job.js";
import {PullGrafanaAlertsJob} from "./jobs/pull-grafana-alerts-job.js";
import {AuditLogRepository} from './dal/auditLogRepository.js';
import {AuditBL} from './bl/audit/audit.bl.js';
import {AuditController} from './api/v1/audit/controller.js';
import {SecretsController} from "./api/v1/secrets/controller.js";
import {SecretsMetadataBL} from "./bl/secrets/secretsMetadata.bl.js";
import {SecretsMetadataRepository} from "./dal/secretsMetadataRepository.js";
import {ServiceCustomFieldRepository} from "./dal/serviceCustomFieldRepository.js";
import {ServiceCustomFieldValueRepository} from "./dal/serviceCustomFieldValueRepository.js";
import {ServiceCustomFieldBL} from "./bl/custom-fields/serviceCustomField.bl.js";
import {CustomFieldsController} from "./api/v1/custom-fields/controller.js";
import { ServicesBL } from './bl/services/services.bl.js';
import { ApiKeyRepository } from './dal/apiKeyRepository.js';
import { ApiKeyBL } from './bl/apiKeys/apiKey.bl.js';
import { ApiKeyController } from './api/v1/apiKeys/controller.js';
import { createApiKeyAuthMiddleware } from './middleware/auth.js';

export async function createApp(db: Database.Database, config?: { enableJobs: boolean }): Promise<express.Application> {
    const app = express();

    app.use(express.json());

    app.use(cors({
        origin: (origin, callback) => {
            // allow requests with no origin (like curl or mobile apps)
            if (!origin) return callback(null, true);
            return callback(null, origin);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"]
    }));

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
    const apiKeyRepo = new ApiKeyRepository(db);

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
        apiKeyRepo.initApiKeysTable()
    ]);

    // BL
    const auditBL = new AuditBL(auditLogRepo);
    const providerBL = new ProviderBL(providerRepo, serviceRepo, secretsMetadataRepo, auditBL);
    const servicesBL = new ServicesBL(serviceRepo, auditBL);
    const integrationBL = new IntegrationBL(integrationRepo);
    const alertBL = new AlertBL(alertRepo);
    const userBL = new UserBL(userRepo, auditBL);
    const secretMetadataBL = new SecretsMetadataBL(secretsMetadataRepo);
    const serviceCustomFieldBL = new ServiceCustomFieldBL(serviceCustomFieldRepo, serviceCustomFieldValueRepo);
    const apiKeyBL = new ApiKeyBL(apiKeyRepo, userRepo, auditBL);

    // Controllers
    const providerController = new ProviderController(providerBL, secretsMetadataRepo);
    const serviceController = new ServiceController(providerRepo, serviceRepo, servicesBL, serviceCustomFieldBL);
    const viewController = new ViewController(new ViewBL(viewRepo));
    const tagController = new TagController(tagRepo, serviceRepo);
    const integrationController = new IntegrationController(integrationBL);
    const alertController = new AlertController(alertBL);
    const usersController = new UsersController(userBL);
    const auditController = new AuditController(auditBL);
    const secretController = new SecretsController(secretMetadataBL);
    const customFieldsController = new CustomFieldsController(serviceCustomFieldBL);
    const apiKeyController = new ApiKeyController(apiKeyBL);

    app.use('/', healthRouter);
    app.use('/api/v1', createV1Router(
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
        apiKeyController,
        apiKeyBL
    ));


    if (config?.enableJobs) {
        new RefreshJob(providerBL).startRefreshJob();
        new PullGrafanaAlertsJob(alertBL, integrationBL, tagRepo).startPullGrafanaAlertsJob();
    }

    return app;
}
