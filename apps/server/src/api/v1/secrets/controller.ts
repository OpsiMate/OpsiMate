import {Request, Response} from "express";
import {
    CreateSecretsMetadataSchema,
    Logger,
    SecretMetadata,
    SecretType
} from "@OpsiMate/shared";
import {z} from "zod";
import {SecretsMetadataBL} from "../../../bl/secrets/secretsMetadata.bl";
import fs from "fs";
import {encryptPassword} from "../../../utils/encryption";

const logger = new Logger("v1/integrations/controller");

const UpdateSecretSchema = z.object({
    displayName: z.string().min(1).optional(),
    secretType: z.nativeEnum(SecretType).optional()
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
    path: ['displayName', 'secretType']
});

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
            // Read the just-saved file
            const filePath = req.file!.path;
            const originalContent = fs.readFileSync(filePath, 'utf-8');

            // Encrypt it
            const encryptedContent = encryptPassword(originalContent);

            // Overwrite file with encrypted content
            fs.writeFileSync(filePath, encryptedContent ?? "");

            const {displayName, secretType} = CreateSecretsMetadataSchema.parse(req.body);
            const createdSecretId: number = await this.secretsBL.createSecretMetadata(displayName, req.file!.filename, secretType);
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

    updateSecret = async (req: Request, res: Response) => {
        try {
            const secretId = parseInt(req.params.id);
            if (isNaN(secretId)) {
                return res.status(400).json({success: false, error: 'Invalid secret ID'});
            }

            // Validate request body
            const updateData = UpdateSecretSchema.parse(req.body);
            
            // Prepare data for update
            const updatePayload: Partial<Omit<SecretMetadata, 'id'>> = {};
            if (updateData.displayName) updatePayload.name = updateData.displayName;
            if (updateData.secretType) updatePayload.type = updateData.secretType;

            // Handle file update if provided
            if (req.file) {
                // Read and encrypt the new file
                const filePath = req.file.path;
                const originalContent = fs.readFileSync(filePath, 'utf-8');
                const encryptedContent = encryptPassword(originalContent);
                
                // Overwrite file with encrypted content
                fs.writeFileSync(filePath, encryptedContent ?? "");
                
                // Update the filename in the payload
                updatePayload.fileName = req.file.filename;
            }

            // If no fields to update, return error
            if (Object.keys(updatePayload).length === 0) {
                return res.status(400).json({
                    success: false, 
                    error: 'No valid fields provided for update. Provide displayName, secretType, or a new file.'
                });
            }

            // Update the secret
            const updated = await this.secretsBL.updateSecretMetadata(secretId, updatePayload);
            
            if (updated) {
                return res.json({success: true, message: 'Secret updated successfully'});
            } else {
                return res.status(404).json({success: false, error: 'Secret not found or update failed'});
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false, 
                    error: 'Validation error', 
                    details: error.errors
                });
            }
            logger.error('Error updating secret:', error);
            return res.status(500).json({success: false, error: 'Internal server error'});
        }
    };

    deleteSecret = async (req: Request, res: Response) => {
        try {
            const secretId = parseInt(req.params.id);
            if (isNaN(secretId)) {
                res.status(400).json({success: false, error: 'Invalid secret ID'});
                return;
            }

            const deleted = await this.secretsBL.deleteSecret(secretId);
            if (deleted) {
                res.json({success: true, message: 'Secret deleted successfully'});
            } else {
                res.status(404).json({success: false, error: 'Secret not found'});
            }
        } catch (error) {
            logger.error('Error deleting secret:', error);
            res.status(500).json({success: false, error: 'Internal server error'});
        }
    };

}
