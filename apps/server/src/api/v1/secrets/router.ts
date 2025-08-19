/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from 'express-promise-router';
import {SecretsController} from './controller';
import multer from "multer";
import {getSecurityConfig} from "../../../config/config";
import path from "path";

const securityConfig = getSecurityConfig();

// storage configuration
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
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

    return router;
}
