import {Logger, SecretMetadata} from "@OpsiMate/shared";


import {SecretsMetadataRepository} from "../../dal/secretsMetadataRepository";

const logger = new Logger('bl/secrets/secret.bl');

export class SecretsMetadataBL {
    constructor(
        private secretsMetadataRepository: SecretsMetadataRepository,
    ) {
    }

    async createSecretMetadata(name: string, secret: string): Promise<number> {
        try {
            const path = "/data/private-keys"
            logger.info(`Creating Secret named ${name} in ${path}`)
            const createdSecret = await this.secretsMetadataRepository.createSecret({name, path})

            logger.info(`Successfully created secret named ${name} in ${path} in ${createdSecret.lastID}`)

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
