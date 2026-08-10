import { Router } from 'express';
import { CustomFieldsController } from './controller';

export default function createCustomFieldsRouter(customFieldsController: CustomFieldsController) {
	const router = Router();

	// Custom Field CRUD operations
	// POST /api/v1/custom-fields
	router.post('/', customFieldsController.createCustomField);

	// GET /api/v1/custom-fields
	router.get('/', customFieldsController.getCustomFields);

	// GET /api/v1/custom-fields/:id
	router.get('/:id', customFieldsController.getCustomFieldById);

	// PUT /api/v1/custom-fields/:id
	router.put('/:id', customFieldsController.updateCustomField);

	// DELETE /api/v1/custom-fields/:id
	router.delete('/:id', customFieldsController.deleteCustomField);

	return router;
}
