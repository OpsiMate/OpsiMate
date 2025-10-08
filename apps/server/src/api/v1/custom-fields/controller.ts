import { Request, Response } from "express";
import { Logger } from "@OpsiMate/shared";
import { z } from "zod";
import { ServiceCustomFieldBL } from "../../../bl/custom-fields/serviceCustomField.bl";
import { AuthenticatedRequest } from "../../../middleware/auth";

const logger = new Logger("v1/custom-fields/controller");

// Validation schemas
const CreateCustomFieldSchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters")
});

const UpdateCustomFieldSchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters")
});

const UpsertCustomFieldValueSchema = z.object({
    serviceId: z.number().int().positive("Service ID must be a positive integer"),
    customFieldId: z.number().int().positive("Custom field ID must be a positive integer"),
    value: z.string().min(1, "Value is required")
});

export class CustomFieldsController {
    constructor(private customFieldsBL: ServiceCustomFieldBL) {}

    // Custom Field CRUD operations
    createCustomField = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { name } = CreateCustomFieldSchema.parse(req.body);
            const customFieldId = await this.customFieldsBL.createCustomField(name, req.user!);

            res.status(201).json({
                success: true,
                data: { id: customFieldId }
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    details: error.errors
                });
            } else {
                logger.error('Error creating custom field:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error'
                });
            }
        }
    };

    getCustomFields = async (req: Request, res: Response) => {
        try {
            const customFields = await this.customFieldsBL.getCustomFields();
            res.json({
                success: true,
                data: { customFields }
            });
        } catch (error) {
            logger.error('Error getting custom fields:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    getCustomFieldById = async (req: Request, res: Response) => {
        try {
            const customFieldId = parseInt(req.params.id);
            if (isNaN(customFieldId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid custom field ID'
                });
                return;
            }

            const customField = await this.customFieldsBL.getCustomFieldById(customFieldId);
            if (customField) {
                res.json({
                    success: true,
                    data: { customField }
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Custom field not found'
                });
            }
        } catch (error) {
            logger.error('Error getting custom field:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    updateCustomField = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const customFieldId = parseInt(req.params.id);
            if (isNaN(customFieldId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid custom field ID'
                });
                return;
            }

            const { name } = UpdateCustomFieldSchema.parse(req.body);
            const updated = await this.customFieldsBL.updateCustomField(customFieldId, name, req.user!);

            if (updated) {
                res.json({
                    success: true,
                    message: 'Custom field updated successfully'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Custom field not found'
                });
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    details: error.errors
                });
            } else {
                logger.error('Error updating custom field:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error'
                });
            }
        }
    };

    deleteCustomField = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const customFieldId = parseInt(req.params.id);
            if (isNaN(customFieldId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid custom field ID'
                });
                return;
            }

            const deleted = await this.customFieldsBL.deleteCustomField(customFieldId, req.user!);
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Custom field deleted successfully'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Custom field not found'
                });
            }
        } catch (error) {
            logger.error('Error deleting custom field:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    // Custom Field Value operations
    upsertCustomFieldValue = async (req: Request, res: Response) => {
        try {
            const { serviceId, customFieldId, value } = UpsertCustomFieldValueSchema.parse(req.body);
            await this.customFieldsBL.upsertCustomFieldValue(serviceId, customFieldId, value);

            res.json({
                success: true,
                message: 'Custom field value upserted successfully'
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    details: error.errors
                });
            } else {
                logger.error('Error upserting custom field value:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error'
                });
            }
        }
    };

    getCustomFieldValuesForService = async (req: Request, res: Response) => {
        try {
            const serviceId = parseInt(req.params.serviceId);
            if (isNaN(serviceId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid service ID'
                });
                return;
            }

            const values = await this.customFieldsBL.getCustomFieldValuesForService(serviceId);
            res.json({
                success: true,
                data: { values }
            });
        } catch (error) {
            logger.error('Error getting custom field values for service:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    deleteCustomFieldValue = async (req: Request, res: Response) => {
        try {
            const serviceId = parseInt(req.params.serviceId);
            const customFieldId = parseInt(req.params.customFieldId);

            if (isNaN(serviceId) || isNaN(customFieldId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid service ID or custom field ID'
                });
                return;
            }

            const deleted = await this.customFieldsBL.deleteCustomFieldValue(serviceId, customFieldId);
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Custom field value deleted successfully'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Custom field value not found'
                });
            }
        } catch (error) {
            logger.error('Error deleting custom field value:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };
}
