import {Request, Response} from "express";
import {
    CreateSecretsMetadataSchema,
    Logger
} from "@OpsiMate/shared";
import {z} from "zod";
import {SecretsMetadataBL} from "../../../bl/secrets/secretsMetadata.bl";

const logger = new Logger("v1/integrations/controller");

export class SecretsController {
    constructor(private secretsBL: SecretsMetadataBL) {
    }

    getSecrets = async (req: Request, res: Response) => {
        try {
            const secretsMetadata = await this.secretsBL.getSecretsMetadata()
            res.json({success: true, data: {secrets: secretsMetadata}});
        } catch (error) {
            logger.error('Error getting secrets:', error);
            res.status(500).json({success: false, error: 'Internal server error'});
        }
    };

    createSecret = async (req: Request, res: Response) => {
        try {
            const {displayName} = CreateSecretsMetadataSchema.parse(req.body);
            const createdSecretId: number = await this.secretsBL.createSecretMetadata(displayName, req.file!.filename);
            res.status(201).json({success: true, data: {id: createdSecretId}});
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({success: false, error: 'Validation error', details: error.errors});
            } else {
                logger.error('Error creating secret:', error);
                res.status(500).json({success: false, error: 'Internal server error'});
            }
        }
    };

}
