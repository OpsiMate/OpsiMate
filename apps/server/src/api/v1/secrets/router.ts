import { Router } from 'express';
import { SecretsController } from './controller';
import multer from 'multer';
import { getSecurityConfig } from '../../../config/config';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// storage configuration
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		// Read lazily, at upload time, not at import time: config.ts caches on
		// first read, and this module used to be the first thing to touch it.
		cb(null, path.resolve(__dirname, '../../', getSecurityConfig().private_keys_path)); // make sure folder exists
	},
	filename: (_req, file, cb) => {
		cb(null, Date.now() + '-' + file.originalname);
	},
});

const upload = multer({ storage });

export default function createSecretsRouter(secretsController: SecretsController) {
	const router = Router();

	// POST /api/v1/secrets
	router.post('/', upload.single('secret_file'), secretsController.createSecret);

	// GET /api/v1/secrets
	router.get('/', secretsController.getSecrets);

	// PUT /api/v1/secrets/:id
	router.put('/:id', upload.single('secret_file'), secretsController.updateSecret);

	// DELETE /api/v1/secrets/:id
	router.delete('/:id', secretsController.deleteSecret);

	return router;
}
