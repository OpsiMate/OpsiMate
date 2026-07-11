/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { authenticateJWT } from '../../middleware/auth';
import { ActionController } from './actions/controller';
import createActionRouter from './actions/router';
import { AlertController } from './alerts/controller';
import alertRouter from './alerts/router';
import { AuditController } from './audit/controller';
import createAuditRouter from './audit/router';
import { CustomActionsController } from './custom-actions/controller';
import createCustomActionsRouter from './custom-actions/router';
import { CustomFieldsController } from './custom-fields/controller';
import createCustomFieldsRouter from './custom-fields/router';
import { DashboardController } from './dashboards/controller';
import dashboardRouter from './dashboards/router';
import { IntegrationController } from './integrations/controller';
import integrationRouter from './integrations/router';
import { PlaygroundController } from './playground/controller';
import playgroundRouter from './playground/router';
import { ProviderController } from './providers/controller';
import providerRouter from './providers/router';
import { SecretsController } from './secrets/controller';
import createSecretsRouter from './secrets/router';
import { ServiceController } from './services/controller';
import serviceRouter from './services/router';
import { EnrichmentController } from './enrichments/controller';
import createEnrichmentRouter from './enrichments/router';
import { MutePolicyController } from './mute-policies/controller';
import createMutePolicyRouter from './mute-policies/router';
import { OncallController } from './oncall/controller';
import createOncallRouter from './oncall/router';
import { TagController } from './tags/controller';
import tagRouter from './tags/router';
import { UsersController } from './users/controller';
import usersRouter from './users/router';
import { RetentionController } from './retention/controller';
import createRetentionRouter from './retention/router';

export default function createV1Router(
	providerController: ProviderController,
	serviceController: ServiceController,
	dashboardController: DashboardController,
	tagController: TagController,
	integrationController: IntegrationController,
	alertController: AlertController,
	usersController: UsersController,
	auditController: AuditController, // optional for backward compatibility
	secretsController: SecretsController,
	customFieldsController: CustomFieldsController,
	customActionsController: CustomActionsController,
	playgroundController: PlaygroundController,
	mutePolicyController: MutePolicyController,
	enrichmentController: EnrichmentController,
	actionController: ActionController,
	retentionController: RetentionController,
	oncallController: OncallController
) {
	const router = PromiseRouter();

	// Public endpoints
	router.post('/users/register', usersController.registerHandler);
	router.post('/users/login', usersController.loginHandler);
	router.get('/users/exists', usersController.usersExistHandler);
	router.post('/users/forgot-password', usersController.forgotPasswordHandler);
	router.post('/users/validate-reset-password-token', usersController.validateResetPasswordTokenHandler);
	router.post('/users/reset-password', usersController.resetPasswordHandler);

	// Playground endpoints (public)
	router.use('/playground', playgroundRouter(playgroundController));

	// JWT-protected endpoints
	router.use(authenticateJWT);
	router.use('/providers', providerRouter(providerController));
	router.use('/services', serviceRouter(serviceController, tagController));
	router.use('/dashboards', dashboardRouter(dashboardController));
	router.use('/tags', tagRouter(tagController));
	router.use('/integrations', integrationRouter(integrationController));
	router.use('/alerts', alertRouter(alertController));
	router.use('/secrets', createSecretsRouter(secretsController));
	router.use('/custom-fields', createCustomFieldsRouter(customFieldsController));
	router.use('/custom-actions', createCustomActionsRouter(customActionsController));
	router.use('/mute-policies', createMutePolicyRouter(mutePolicyController));
	router.use('/oncall', createOncallRouter(oncallController));
	router.use('/enrichments', createEnrichmentRouter(enrichmentController));
	router.use('/actions', createActionRouter(actionController));
	// All other /users endpoints (except /register and /login) are protected
	router.use('/users', usersRouter(usersController));
	router.use('/audit', createAuditRouter(auditController));
	router.use('/retention', createRetentionRouter(retentionController));

	return router;
}
