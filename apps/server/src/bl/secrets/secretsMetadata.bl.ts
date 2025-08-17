import {Logger, SecretMetadata} from "@OpsiMate/shared";


import {SecretsMetadataRepository} from "../../dal/secretsMetadataRepository";

const logger = new Logger('bl/secrets/secret.bl');

export class SecretsMetadataBL {
    constructor(
        private secretsMetadataRepository: SecretsMetadataRepository,
    ) {
    }

    async createSecretMetadata(name: string, secret: string): Promise<number> {
        const path = "/data/private-keys"
        const createdSecret = await this.secretsMetadataRepository.createSecret({name, path})

        return createdSecret.lastID
    }

    async getSecretsMetadata(): Promise<SecretMetadata[]> {

        return await this.secretsMetadataRepository.getSecrets()
    }
}
