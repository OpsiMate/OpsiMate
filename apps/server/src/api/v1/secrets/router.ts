/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import {SecretsController} from './controller';
import multer from "multer";
import {getSecurityConfig} from "../../../config/config";
import * as path from 'node:path';
// REMOVED: Incompatible ESM imports for __filename/dirname:
// import { fileURLToPath } from 'node:url';
// import { dirname } from 'node:path';

// REMOVED: Incompatible ESM usage:
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

const securityConfig = getSecurityConfig();

// storage configuration
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        // Using global __dirname, which is available when compiling to CommonJS (Jest default).
        // @ts-ignore added to suppress potential TS errors about undeclared global.
        // It's crucial that this line uses __dirname, which is why the previous lines were removed.
        // @ts-ignore
        cb(null, path.resolve(__dirname, '../../', securityConfig.private_keys_path)); // make sure folder exists
    },
    filename: (_req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({storage});

export default function createSecretsRouter(secretsController: SecretsController) {

    const router = PromiseRouter();

    // POST /api/v1/secrets
    router.post('/', upload.single("secret_file"), secretsController.createSecret);

    // GET /api/v1/secrets
    router.get('/', secretsController.getSecrets);

    // PUT /api/v1/secrets/:id
    router.put('/:id', upload.single("secret_file"), secretsController.updateSecret);

    // DELETE /api/v1/secrets/:id
    router.delete('/:id', secretsController.deleteSecret);

    return router;
}
