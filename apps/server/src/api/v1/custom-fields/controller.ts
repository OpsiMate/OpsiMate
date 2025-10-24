import { Request, Response } from 'express';
import { Logger } from '@OpsiMate/shared';
import { z } from 'zod';
import { ServiceCustomFieldBL } from '../../../bl/custom-fields/serviceCustomField.bl';
import { isZodError } from '../../../utils/isZodError';

const logger = new Logger('v1/custom-fields/controller');

// Validation schemas
const CreateCustomFieldSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
});

const UpdateCustomFieldSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
});

const UpsertCustomFieldValueSchema = z.object({
	serviceId: z.number().int().positive('Service ID must be a positive integer'),
	customFieldId: z.number().int().positive('Custom field ID must be a positive integer'),
	value: z.string().min(1, 'Value is required'),
});

export class CustomFieldsController {
	constructor(private customFieldsBL: ServiceCustomFieldBL) {}

	// Custom Field CRUD operations
	createCustomField = async (req: Request, res: Response) => {
		try {
			const { name } = CreateCustomFieldSchema.parse(req.body);
			const customFieldId = await this.customFieldsBL.createCustomField(name);

			return res.status(201).json({
				success: true,
				data: { id: customFieldId },
			});
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({
					success: false,
					error: 'Validation error',
					details: error.errors,
				});
			} else {
				logger.error('Error creating custom field:', error);
				return res.status(500).json({
					success: false,
					error: 'Internal server error',
				});
			}
		}
	};

	getCustomFields = async (req: Request, res: Response) => {
		try {
			const customFields = await this.customFieldsBL.getCustomFields();
			return res.json({
				success: true,
				data: { customFields },
			});
		} catch (error) {
			logger.error('Error getting custom fields:', error);
			return res.status(500).json({
				success: false,
				error: 'Internal server error',
			});
		}
	};

	getCustomFieldById = async (req: Request, res: Response) => {
		try {
			const customFieldId = parseInt(req.params.id);
			if (isNaN(customFieldId)) {
				return res.status(400).json({
					success: false,
					error: 'Invalid custom field ID',
				});
			}

			const customField = await this.customFieldsBL.getCustomFieldById(customFieldId);
			if (customField) {
				return res.json({
					success: true,
					data: { customField },
				});
			} else {
				return res.status(404).json({
					success: false,
					error: 'Custom field not found',
				});
			}
		} catch (error) {
			logger.error('Error getting custom field:', error);
			return res.status(500).json({
				success: false,
				error: 'Internal server error',
			});
		}
	};

	updateCustomField = async (req: Request, res: Response) => {
		try {
			const customFieldId = parseInt(req.params.id);
			if (isNaN(customFieldId)) {
				return res.status(400).json({
					success: false,
					error: 'Invalid custom field ID',
				});
			}

			const { name } = UpdateCustomFieldSchema.parse(req.body);
			const updated = await this.customFieldsBL.updateCustomField(customFieldId, name);

			if (updated) {
				return res.json({
					success: true,
					message: 'Custom field updated successfully',
				});
			} else {
				return res.status(404).json({
					success: false,
					error: 'Custom field not found',
				});
			}
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({
					success: false,
					error: 'Validation error',
					details: error.errors,
				});
			} else {
				logger.error('Error updating custom field:', error);
				return res.status(500).json({
					success: false,
					error: 'Internal server error',
				});
			}
		}
	};

	deleteCustomField = async (req: Request, res: Response) => {
		try {
			const customFieldId = parseInt(req.params.id);
			if (isNaN(customFieldId)) {
				return res.status(400).json({
					success: false,
					error: 'Invalid custom field ID',
				});
			}

			const deleted = await this.customFieldsBL.deleteCustomField(customFieldId);
			if (deleted) {
				return res.json({
					success: true,
					message: 'Custom field deleted successfully',
				});
			} else {
				return res.status(404).json({
					success: false,
					error: 'Custom field not found',
				});
			}
		} catch (error) {
			logger.error('Error deleting custom field:', error);
			return res.status(500).json({
				success: false,
				error: 'Internal server error',
			});
		}
	};

	// Custom Field Value operations
	upsertCustomFieldValue = async (req: Request, res: Response) => {
		try {
			const { serviceId, customFieldId, value } = UpsertCustomFieldValueSchema.parse(req.body);
			await this.customFieldsBL.upsertCustomFieldValue(serviceId, customFieldId, value);

			return res.json({
				success: true,
				message: 'Custom field value upserted successfully',
			});
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({
					success: false,
					error: 'Validation error',
					details: error.errors,
				});
			} else {
				logger.error('Error upserting custom field value:', error);
				return res.status(500).json({
					success: false,
					error: 'Internal server error',
				});
			}
		}
	};

	getCustomFieldValuesForService = async (req: Request, res: Response) => {
		try {
			const serviceId = parseInt(req.params.serviceId);
			if (isNaN(serviceId)) {
				return res.status(400).json({
					success: false,
					error: 'Invalid service ID',
				});
			}

			const values = await this.customFieldsBL.getCustomFieldValuesForService(serviceId);
			return res.json({
				success: true,
				data: { values },
			});
		} catch (error) {
			logger.error('Error getting custom field values for service:', error);
			return res.status(500).json({
				success: false,
				error: 'Internal server error',
			});
		}
	};

	deleteCustomFieldValue = async (req: Request, res: Response) => {
		try {
			const serviceId = parseInt(req.params.serviceId);
			const customFieldId = parseInt(req.params.customFieldId);

			if (isNaN(serviceId) || isNaN(customFieldId)) {
				return res.status(400).json({
					success: false,
					error: 'Invalid service ID or custom field ID',
				});
			}

			const deleted = await this.customFieldsBL.deleteCustomFieldValue(serviceId, customFieldId);
			if (deleted) {
				return res.json({
					success: true,
					message: 'Custom field value deleted successfully',
				});
			} else {
				return res.status(404).json({
					success: false,
					error: 'Custom field value not found',
				});
			}
		} catch (error) {
			logger.error('Error deleting custom field value:', error);
			return res.status(500).json({
				success: false,
				error: 'Internal server error',
			});
		}
	};
}
