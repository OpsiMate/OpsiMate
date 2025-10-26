import PromiseRouter from 'express-promise-router';
import { ApiKeyController } from './controller.js';

export default function createApiKeysRouter(apiKeyController: ApiKeyController) {
    const router = PromiseRouter();

    router.post('/', apiKeyController.createApiKeyHandler);
    router.get('/', apiKeyController.getApiKeysHandler);
    router.get('/:apiKeyId', apiKeyController.getApiKeyHandler);
    router.put('/:apiKeyId', apiKeyController.updateApiKeyHandler);
    router.delete('/:apiKeyId', apiKeyController.deleteApiKeyHandler);

    return router;
}
