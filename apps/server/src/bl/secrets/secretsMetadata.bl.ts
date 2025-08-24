import {Logger, SecretMetadata, SecretType} from "@OpsiMate/shared";


import {SecretsMetadataRepository} from "../../dal/secretsMetadataRepository";
import {getSecurityConfig} from "../../config/config";
import path from "path";

const logger = new Logger('bl/secrets/secret.bl');

export class SecretsMetadataBL {
    constructor(
        private secretsMetadataRepository: SecretsMetadataRepository,
    ) {
    }

    async createSecretMetadata(displayName: string, newName: string, secretType: SecretType = SecretType.SSH): Promise<number> {
        try {
            const fullPath = path.resolve(getSecurityConfig().private_keys_path, newName)
            logger.info(`Creating Secret named ${displayName} in ${newName}`)
            const createdSecret = await this.secretsMetadataRepository.createSecret({name: displayName, path: fullPath, type: secretType})

            logger.info(`Successfully created secret named ${displayName} in ${newName} in ${createdSecret.lastID}`)

            return createdSecret.lastID
        } catch (e) {
            logger.error("Error occurred creating Secret", e);

            throw e
        }
    }

    async getSecretsMetadata(): Promise<SecretMetadata[]> {

        try {
            logger.info(`Fetch all secret metadata`);
            const secrets = await this.secretsMetadataRepository.getSecrets()
            logger.info(`Successfully fetch [${secrets.length}] secret metadata`)

            return secrets
        } catch (e) {
            logger.error("Error occurred fetching secret metadata", e);

            throw e
        }
    }

    async deleteSecret(id: number): Promise<boolean> {
        try {
            logger.info(`Deleting secret with id ${id}`);
            
            // First get the secret to get the file path before deleting
            const secrets = await this.secretsMetadataRepository.getSecrets();
            const secretToDelete = secrets.find(secret => secret.id === id);
            
            if (!secretToDelete) {
                logger.warn(`Secret with id ${id} not found`);
                return false;
            }

            // Delete from database
            const deleted = await this.secretsMetadataRepository.deleteSecret(id);
            
            if (!deleted) {
                logger.warn(`Failed to delete secret with id ${id} from database`);
                return false;
            }

            // Delete the actual file from filesystem
            const fs = await import('fs');
            try {
                if (fs.existsSync(secretToDelete.path)) {
                    fs.unlinkSync(secretToDelete.path);
                    logger.info(`Successfully deleted secret file: ${secretToDelete.path}`);
                } else {
                    logger.warn(`Secret file not found on filesystem: ${secretToDelete.path}`);
                }
            } catch (fileError) {
                logger.error(`Error deleting secret file: ${secretToDelete.path}`, fileError);
                // Don't throw here - the database record is already deleted
            }

            logger.info(`Successfully deleted secret with id ${id}`);
            return true;
        } catch (e) {
            logger.error(`Error occurred deleting secret with id ${id}`, e);
            throw e;
        }
    }
}
