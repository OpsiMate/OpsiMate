/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { SecretsController } from './controller';


export default function createSecretsRouter(secretsController: SecretsController) {
    const router = PromiseRouter();

    // POST /api/v1/secrets
    router.post('/', secretsController.createSecret);

    // GET /api/v1/secrets
    router.get('/', secretsController.getSecrets);

    return router;
}
