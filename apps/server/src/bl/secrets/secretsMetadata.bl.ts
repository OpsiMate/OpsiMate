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
            logger.info(`Creating Secret named ${displayName} in ${newName}`)
            const createdSecret = await this.secretsMetadataRepository.createSecret({name: displayName, fileName: newName, type: secretType})

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

    async updateSecretMetadata(id: number, data: Partial<Omit<SecretMetadata, 'id'>>): Promise<boolean> {
        try {
            logger.info(`Updating secret with id ${id}, data: ${JSON.stringify(data)}`);
            
            // Check if secret exists
            const secret = await this.secretsMetadataRepository.getSecretById(id);
            if (!secret) {
                logger.warn(`Secret with id ${id} not found`);
                return false;
            }

            // If fileName is being updated, verify the new file exists
            if (data.fileName && data.fileName !== secret.fileName) {
                const fs = await import('fs');
                const oldPath = path.resolve(getSecurityConfig().private_keys_path, secret.fileName);
                const newPath = path.resolve(getSecurityConfig().private_keys_path, data.fileName);
                
                // Check if new file exists
                if (!fs.existsSync(newPath)) {
                    throw new Error(`New secret file not found: ${data.fileName}`);
                }
                
                // If the filename is changing, we should verify the old file exists before trying to delete it
                if (fs.existsSync(oldPath)) {
                    // Delete the old file if it exists
                    try {
                        fs.unlinkSync(oldPath);
                        logger.info(`Successfully deleted old secret file: ${oldPath}`);
                    } catch (fileError) {
                        const error = fileError as Error;
                        logger.error(`Error deleting old secret file: ${oldPath}`, error);
                        throw new Error(`Failed to remove old secret file: ${error.message}`);
                    }
                }
            }

            // Update the secret metadata in the database
            const updated = await this.secretsMetadataRepository.updateSecret(id, data);
            
            if (!updated) {
                logger.warn(`Failed to update secret with id ${id} in database`);
                return false;
            }

            logger.info(`Successfully updated secret with id ${id}`);
            return true;
        } catch (e) {
            logger.error(`Error occurred updating secret with id ${id}`, e);
            throw e;
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
                // Construct the full path since we now store only the filename
                const fullPath = path.resolve(getSecurityConfig().private_keys_path, secretToDelete.fileName);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    logger.info(`Successfully deleted secret file: ${fullPath}`);
                } else {
                    logger.warn(`Secret file not found on filesystem: ${fullPath}`);
                }
            } catch (fileError) {
                logger.error(`Error deleting secret file: ${secretToDelete.fileName}`, fileError);
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
