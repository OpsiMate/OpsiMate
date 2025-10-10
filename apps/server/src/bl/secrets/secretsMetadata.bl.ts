import { Logger, SecretMetadata, SecretType } from "@OpsiMate/shared";

import { SecretsMetadataRepository } from "../../dal/secretsMetadataRepository";
import { getSecurityConfig } from "../../config/config";
import path from "path";

const logger = new Logger("bl/secrets/secret.bl");

export class SecretsMetadataBL {
  constructor(private secretsMetadataRepository: SecretsMetadataRepository) {}

  async createSecretMetadata(
    displayName: string,
    newName: string,
    secretType: SecretType = SecretType.SSH,
  ): Promise<number> {
    try {
      logger.info(`Creating Secret named ${displayName} in ${newName}`);
      const createdSecret = await this.secretsMetadataRepository.createSecret({
        name: displayName,
        fileName: newName,
        type: secretType,
      });

      logger.info(
        `Successfully created secret named ${displayName} in ${newName} in ${createdSecret.lastID}`,
      );

      return createdSecret.lastID;
    } catch (e) {
      logger.error("Error occurred creating Secret", e);

      throw e;
    }
  }

  async getSecretsMetadata(): Promise<SecretMetadata[]> {
    try {
      logger.info(`Fetch all secret metadata`);
      const secrets = await this.secretsMetadataRepository.getSecrets();
      logger.info(`Successfully fetch [${secrets.length}] secret metadata`);

      return secrets;
    } catch (e) {
      logger.error("Error occurred fetching secret metadata", e);

      throw e;
    }
  }

  async updateSecretMetadata(
    id: number,
    displayName?: string,
    newFileName?: string,
    secretType?: SecretType,
  ): Promise<boolean> {
    try {
      logger.info(`Updating secret with id ${id}`);

      // Check if secret exists
      const existingSecret =
        await this.secretsMetadataRepository.getSecretById(id);
      if (!existingSecret) {
        logger.warn(`Secret with id ${id} not found`);
        return false;
      }

      // Prepare update data
      const updateData: Partial<SecretMetadata> = {};
      if (displayName !== undefined) {
        updateData.name = displayName;
      }
      if (newFileName !== undefined) {
        updateData.fileName = newFileName;
      }
      if (secretType !== undefined) {
        updateData.type = secretType;
      }

      // Update in database
      const updated = await this.secretsMetadataRepository.updateSecret(
        id,
        updateData,
      );

      if (!updated) {
        logger.warn(`Failed to update secret with id ${id} in database`);
        return false;
      }

      // If filename changed, handle file operations
      if (
        newFileName !== undefined &&
        newFileName !== existingSecret.fileName
      ) {
        const fs = await import("fs");
        try {
          const oldPath = path.resolve(
            getSecurityConfig().private_keys_path,
            existingSecret.fileName,
          );
          const newPath = path.resolve(
            getSecurityConfig().private_keys_path,
            newFileName,
          );

          // Move the file if it exists
          if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            logger.info(
              `Successfully moved secret file from ${oldPath} to ${newPath}`,
            );
          } else {
            logger.warn(`Old secret file not found on filesystem: ${oldPath}`);
          }
        } catch (fileError) {
          logger.error(
            `Error moving secret file from ${existingSecret.fileName} to ${newFileName}`,
            fileError,
          );
          // Don't throw here - the database record is already updated
        }
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
      const secretToDelete = secrets.find((secret) => secret.id === id);

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
      const fs = await import("fs");
      try {
        // Construct the full path since we now store only the filename
        const fullPath = path.resolve(
          getSecurityConfig().private_keys_path,
          secretToDelete.fileName,
        );
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          logger.info(`Successfully deleted secret file: ${fullPath}`);
        } else {
          logger.warn(`Secret file not found on filesystem: ${fullPath}`);
        }
      } catch (fileError) {
        logger.error(
          `Error deleting secret file: ${secretToDelete.fileName}`,
          fileError,
        );
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
