import { Request, Response } from 'express';
import { CreateSecretsMetadataSchema, UpdateSecretsMetadataSchema, Logger, SecretType } from '@OpsiMate/shared';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { SecretsMetadataBL } from '../../../bl/secrets/secretsMetadata.bl';
import fs from 'fs';
import { encryptPassword } from '../../../utils/encryption';
import { isZodError } from '../../../utils/isZodError';
import { routeParam } from '../../../utils/routeParams';
import { validateKubeConfig, validatePublicSSHKey } from '../../../utils/validators/validators';

const logger = new Logger('api/v1/secrets/controller');

export class SecretsController {
	constructor(private secretsBL: SecretsMetadataBL) {}

	getSecrets = async (req: Request, res: Response) => {
		try {
			const secretsMetadata = await this.secretsBL.getSecretsMetadata();
			return res.json({ success: true, data: { secrets: secretsMetadata } });
		} catch (error) {
			logger.error('Error getting secrets:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	createSecret = async (req: AuthenticatedRequest, res: Response) => {
		let handedToBL = false;
		try {
			const { displayName, secretType } = CreateSecretsMetadataSchema.parse(req.body);
			if (!req.file) {
				return res.status(400).json({ success: false, error: 'secret_file is required' });
			}

			if (!this.encryptUploadedSecret(req.file, secretType)) {
				this.removeUploadedFile(req.file);
				return res.status(422).json({
					success: false,
					error: 'Invalid file content',
				});
			}

			// From here the record may reference the (already encrypted) file, so keep it on failure
			handedToBL = true;
			const createdSecretId: number = await this.secretsBL.createSecretMetadata(
				displayName,
				req.file.filename,
				secretType,
				req.user
			);

			return res.status(201).json({ success: true, data: { id: createdSecretId } });
		} catch (error) {
			if (!handedToBL) {
				this.removeUploadedFile(req.file);
			}
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			} else {
				logger.error('Error creating secret:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	updateSecret = async (req: AuthenticatedRequest, res: Response) => {
		let handedToBL = false;
		try {
			const secretId = parseInt(routeParam(req, 'id'));
			if (isNaN(secretId)) {
				this.removeUploadedFile(req.file);
				return res.status(400).json({ success: false, error: 'Invalid secret ID' });
			}

			// Parse the request body for metadata updates
			const { displayName, secretType } = UpdateSecretsMetadataSchema.parse(req.body);

			let newFileName: string | undefined;

			// If a new file is uploaded, handle it
			if (req.file) {
				if (!this.encryptUploadedSecret(req.file, secretType)) {
					this.removeUploadedFile(req.file);
					return res.status(422).json({
						success: false,
						error: 'Invalid file content',
					});
				}
				newFileName = req.file.filename;
			}

			handedToBL = true;
			const updated = await this.secretsBL.updateSecretMetadata(
				secretId,
				displayName,
				newFileName,
				secretType,
				req.user
			);

			if (updated) {
				return res.json({ success: true, message: 'Secret updated successfully' });
			} else {
				this.removeUploadedFile(req.file);
				return res.status(404).json({ success: false, error: 'Secret not found' });
			}
		} catch (error) {
			if (!handedToBL) {
				this.removeUploadedFile(req.file);
			}
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			} else {
				logger.error('Error updating secret:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	private encryptUploadedSecret(file: Express.Multer.File, secretType?: SecretType): boolean {
		const originalContent = fs.readFileSync(file.path, 'utf-8');
		const isValidFile =
			secretType === SecretType.SSH ? validatePublicSSHKey(originalContent) : validateKubeConfig(originalContent);
		if (!isValidFile) {
			return false;
		}
		fs.writeFileSync(file.path, encryptPassword(originalContent) ?? '');
		return true;
	}

	private removeUploadedFile(file?: Express.Multer.File) {
		if (!file) {
			return;
		}
		try {
			fs.unlinkSync(file.path);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				logger.error(`Failed to remove uploaded secret file ${file.path}`, error);
			}
		}
	}

	deleteSecret = async (req: AuthenticatedRequest, res: Response) => {
		try {
			const secretId = parseInt(routeParam(req, 'id'));
			if (isNaN(secretId)) {
				return res.status(400).json({ success: false, error: 'Invalid secret ID' });
			}

			const deleted = await this.secretsBL.deleteSecret(secretId, req.user);
			if (deleted) {
				return res.json({ success: true, message: 'Secret deleted successfully' });
			} else {
				return res.status(404).json({ success: false, error: 'Secret not found' });
			}
		} catch (error) {
			logger.error('Error deleting secret:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};
}
