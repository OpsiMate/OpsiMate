/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import { SecretsController } from './controller';
import multer from 'multer';
import { getSecurityConfig } from '../../../config/config';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { authenticateJWT } from '../../../middleware/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const securityConfig = getSecurityConfig();

// storage configuration
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, path.resolve(__dirname, '../../', securityConfig.private_keys_path)); // make sure folder exists
    },
    filename: (_req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

export default function createSecretsRouter(secretsController: SecretsController) {
    const router = PromiseRouter();

    // POST /api/v1/secrets
    router.post('/', authenticateJWT, upload.single('secret_file'), secretsController.createSecret);

    // GET /api/v1/secrets
    router.get('/', authenticateJWT, secretsController.getSecrets);

    // DELETE /api/v1/secrets/:id
    router.delete('/:id', authenticateJWT, secretsController.deleteSecret);

    // PATCH /api/v1/secrets/:id
    router.patch('/:id', authenticateJWT, upload.single('secret_file'), secretsController.updateSecretOnServer);

    return router;
}
