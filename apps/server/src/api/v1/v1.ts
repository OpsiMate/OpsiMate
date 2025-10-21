/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import providerRouter from './providers/router';
import serviceRouter from './services/router';
import viewRouter from './views/router';
import tagRouter from './tags/router';
import integrationRouter from './integrations/router';
import alertRouter from './alerts/router';
import usersRouter from './users/router';
import createAuditRouter from './audit/router';
import {ProviderController} from "./providers/controller.js";
import {ServiceController} from "./services/controller.js";
import {ViewController} from "./views/controller.js";
import {TagController} from "./tags/controller.js";
import {IntegrationController} from "./integrations/controller.js";
import {AlertController} from "./alerts/controller.js";
import {UsersController} from './users/controller';
import {AuditController} from './audit/controller';
import {authenticateJWT} from '../../middleware/auth';
import createSecretsRouter from "./secrets/router.js";
import {SecretsController} from "./secrets/controller.js";
import createCustomFieldsRouter from "./custom-fields/router.js";
import {CustomFieldsController} from "./custom-fields/controller.js";


export default function createV1Router(
    providerController: ProviderController,
    serviceController: ServiceController,
    viewController: ViewController,
    tagController: TagController,
    integrationController: IntegrationController,
    alertController: AlertController,
    usersController: UsersController,
    auditController: AuditController, // optional for backward compatibility
    secretsController: SecretsController,
    customFieldsController: CustomFieldsController,
) {
    const router = PromiseRouter();

    // Public endpoints
    router.post('/users/register', usersController.registerHandler);
    router.post('/users/login', usersController.loginHandler);
    router.get('/users/exists', usersController.usersExistHandler);
    router.post('/users/forgot-password', usersController.forgotPasswordHandler);
    router.post('/users/validate-reset-password-token', usersController.validateResetPasswordTokenHandler);
    router.post('/users/reset-password', usersController.resetPasswordHandler);

    // JWT-protected endpoints
    router.use(authenticateJWT);
    router.use('/providers', providerRouter(providerController));
    router.use('/services', serviceRouter(serviceController, tagController));
    router.use('/views', viewRouter(viewController));
    router.use('/tags', tagRouter(tagController));
    router.use('/integrations', integrationRouter(integrationController));
    router.use('/alerts', alertRouter(alertController));
    router.use('/secrets', createSecretsRouter(secretsController));
    router.use('/custom-fields', createCustomFieldsRouter(customFieldsController));
    // All other /users endpoints (except /register and /login) are protected
    router.use('/users', usersRouter(usersController));
    router.use('/audit', createAuditRouter(auditController));

    return router;
}
