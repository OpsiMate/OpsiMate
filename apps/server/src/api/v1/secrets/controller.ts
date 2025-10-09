import {Request, Response} from "express";
import {
    CreateSecretsMetadataSchema,
    UpdateSecretsMetadataSchema,
    Logger
} from "@OpsiMate/shared";
import {SecretsMetadataBL} from "../../../bl/secrets/secretsMetadata.bl";
import fs from "fs";
import {encryptPassword} from "../../../utils/encryption";
import { isZodError } from "../../../utils/isZodError";

const logger = new Logger("v1/integrations/controller");

export class SecretsController {
    constructor(private secretsBL: SecretsMetadataBL) {
    }

    getSecrets = async (req: Request, res: Response) => {
        try {
            const secretsMetadata = await this.secretsBL.getSecretsMetadata()
            return res.json({success: true, data: {secrets: secretsMetadata}});
        } catch (error) {
            logger.error('Error getting secrets:', error);
            return res.status(500).json({success: false, error: 'Internal server error'});
        }
    };

    createSecret = async (req: Request, res: Response) => {
        try {
            // Read the just-saved file
            const filePath = req.file!.path;
            const originalContent = fs.readFileSync(filePath, 'utf-8');

            // Encrypt it
            const encryptedContent = encryptPassword(originalContent);

            // Overwrite file with encrypted content
            fs.writeFileSync(filePath, encryptedContent ?? "");

            const {displayName, secretType} = CreateSecretsMetadataSchema.parse(req.body);
            const createdSecretId: number = await this.secretsBL.createSecretMetadata(displayName, req.file!.filename, secretType);
            return res.status(201).json({success: true, data: {id: createdSecretId}});
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({success: false, error: 'Validation error', details: error.errors});
            } else {
                logger.error('Error creating secret:', error);
                return res.status(500).json({success: false, error: 'Internal server error'});
            }
        }
    };

    updateSecret = async (req: Request, res: Response) => {
        try {
            const secretId = parseInt(req.params.id);
            if (isNaN(secretId)) {
                return res.status(400).json({success: false, error: 'Invalid secret ID'});
            }

            // Parse the request body for metadata updates
            const {displayName, secretType} = UpdateSecretsMetadataSchema.parse(req.body);
            
            let newFileName: string | undefined;
            
            // If a new file is uploaded, handle it
            if (req.file) {
                // Read the just-saved file
                const filePath = req.file.path;
                const originalContent = fs.readFileSync(filePath, 'utf-8');

                // Encrypt it
                const encryptedContent = encryptPassword(originalContent);

                // Overwrite file with encrypted content
                fs.writeFileSync(filePath, encryptedContent ?? "");
                
                newFileName = req.file.filename;
            }

            const updated = await this.secretsBL.updateSecretMetadata(
                secretId, 
                displayName, 
                newFileName, 
                secretType
            );
            
            if (updated) {
                return res.json({success: true, message: 'Secret updated successfully'});
            } else {
                return res.status(404).json({success: false, error: 'Secret not found'});
            }
        } catch (error) {
            if (isZodError(error)) {
                return res.status(400).json({success: false, error: 'Validation error', details: error.errors});
            } else {
                logger.error('Error updating secret:', error);
                return res.status(500).json({success: false, error: 'Internal server error'});
            }
        }
    };

    deleteSecret = async (req: Request, res: Response) => {
        try {
            const secretId = parseInt(req.params.id);
            if (isNaN(secretId)) {
                return res.status(400).json({success: false, error: 'Invalid secret ID'});
            }

            const deleted = await this.secretsBL.deleteSecret(secretId);
            if (deleted) {
                return res.json({success: true, message: 'Secret deleted successfully'});
            } else {
                return res.status(404).json({success: false, error: 'Secret not found'});
            }
        } catch (error) {
            logger.error('Error deleting secret:', error);
            return res.status(500).json({success: false, error: 'Internal server error'});
        }
    };

}
