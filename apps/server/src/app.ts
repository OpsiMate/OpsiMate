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
import Database from "better-sqlite3";
import {RefreshJob} from "./jobs/refresh-job";
import {PullGrafanaAlertsJob} from "./jobs/pull-grafana-alerts-job";
import { AuditLogRepository } from './dal/auditLogRepository';
import { AuditBL } from './bl/audit/audit.bl';
import { AuditController } from './api/v1/audit/controller';
import { SecretsController } from "./api/v1/secrets/controller";
import { SecretsMetadataBL } from "./bl/secrets/secretsMetadata.bl";
import { SecretsMetadataRepository } from "./dal/secretsMetadataRepository";

export async function createApp(db: Database.Database, config?: { enableJobs: boolean }): Promise<express.Application> {
    const app = express();

    app.use(express.json());
    app.use(cors({
        origin: 'http://localhost:8080',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization']
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
        secretsMetadataRepo.initSecretsMetadataTable()
    ]);

    // BL
    const auditBL = new AuditBL(auditLogRepo);
    const providerBL = new ProviderBL(providerRepo, serviceRepo, auditBL);
    const integrationBL = new IntegrationBL(integrationRepo);
    const alertBL = new AlertBL(alertRepo);
    const userBL = new UserBL(userRepo);
    const secretMetadataBL = new SecretsMetadataBL(secretsMetadataRepo)

    // Controllers
    const providerController = new ProviderController(providerBL);
    const serviceController = new ServiceController(providerRepo, serviceRepo);
    const viewController = new ViewController(new ViewBL(viewRepo));
    const tagController = new TagController(tagRepo, serviceRepo);
    const integrationController = new IntegrationController(integrationBL);
    const alertController = new AlertController(alertBL);
    const usersController = new UsersController(userBL);
    const auditController = new AuditController(auditBL);
    const secretController = new SecretsController(secretMetadataBL);

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
        secretController
    ));



    if (config?.enableJobs) {
        new RefreshJob(providerBL, serviceRepo).startRefreshJob();
        new PullGrafanaAlertsJob(alertBL, integrationBL, tagRepo).startPullGrafanaAlertsJob();
    }

    return app;
}
