import {Logger, SecretMetadata} from "@OpsiMate/shared";


import {SecretsMetadataRepository} from "../../dal/secretsMetadataRepository";
import {getSecurityConfig} from "../../config/config";
import path from "path";

const logger = new Logger('bl/secrets/secret.bl');

export class SecretsMetadataBL {
    constructor(
        private secretsMetadataRepository: SecretsMetadataRepository,
    ) {
    }

    async createSecretMetadata(displayName: string, newName: string): Promise<number> {
        try {
            const fullPath = path.resolve(getSecurityConfig().private_keys_path, newName)
            logger.info(`Creating Secret named ${displayName} in ${newName}`)
            const createdSecret = await this.secretsMetadataRepository.createSecret({name: displayName, path: fullPath})

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
}
