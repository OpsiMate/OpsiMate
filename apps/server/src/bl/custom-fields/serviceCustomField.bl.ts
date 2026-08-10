import { Logger, ServiceCustomField } from '@OpsiMate/shared';
import { ServiceCustomFieldRepository } from '../../dal/serviceCustomFieldRepository';

const logger = new Logger('bl/custom-fields/serviceCustomField.bl');

// Custom field DEFINITIONS only. The per-service VALUES half went away with the provider/
// services feature (#783); Settings still manages the field definitions themselves.
export class ServiceCustomFieldBL {
	constructor(private customFieldRepository: ServiceCustomFieldRepository) {}

	async createCustomField(name: string): Promise<number> {
		try {
			logger.info(`Creating custom field with name: ${name}`);

			const existingField = await this.customFieldRepository.getCustomFields();
			const duplicate = existingField.find((field) => field.name.toLowerCase() === name.toLowerCase());

			if (duplicate) {
				throw new Error(`Custom field with name '${name}' already exists`);
			}

			const result = await this.customFieldRepository.createCustomField({ name });
			logger.info(`Successfully created custom field '${name}' with ID: ${result.lastID}`);

			return result.lastID;
		} catch (error) {
			logger.error(`Error creating custom field '${name}'`, error);
			throw error;
		}
	}

	async getCustomFields(): Promise<ServiceCustomField[]> {
		try {
			logger.info('Fetching all custom fields');
			const fields = await this.customFieldRepository.getCustomFields();
			logger.info(`Successfully fetched ${fields.length} custom fields`);

			return fields;
		} catch (error) {
			logger.error('Error fetching custom fields', error);
			throw error;
		}
	}

	async getCustomFieldById(id: number): Promise<ServiceCustomField | null> {
		try {
			logger.info(`Fetching custom field with ID: ${id}`);
			const field = await this.customFieldRepository.getCustomFieldById(id);

			if (field) {
				logger.info(`Successfully fetched custom field '${field.name}'`);
			} else {
				logger.warn(`Custom field with ID ${id} not found`);
			}

			return field;
		} catch (error) {
			logger.error(`Error fetching custom field with ID ${id}`, error);
			throw error;
		}
	}

	async updateCustomField(id: number, name: string): Promise<boolean> {
		try {
			logger.info(`Updating custom field ${id} with name: ${name}`);

			const existingField = await this.customFieldRepository.getCustomFieldById(id);
			if (!existingField) {
				throw new Error(`Custom field with ID ${id} not found`);
			}

			const allFields = await this.customFieldRepository.getCustomFields();
			const duplicate = allFields.find(
				(field) => field.id !== id && field.name.toLowerCase() === name.toLowerCase()
			);

			if (duplicate) {
				throw new Error(`Custom field with name '${name}' already exists`);
			}

			const updated = await this.customFieldRepository.updateCustomField(id, { name });

			if (updated) {
				logger.info(`Successfully updated custom field ${id} to name '${name}'`);
			} else {
				logger.warn(`No changes made to custom field ${id}`);
			}

			return updated;
		} catch (error) {
			logger.error(`Error updating custom field ${id}`, error);
			throw error;
		}
	}

	async deleteCustomField(id: number): Promise<boolean> {
		try {
			logger.info(`Deleting custom field with ID: ${id}`);

			const field = await this.customFieldRepository.getCustomFieldById(id);
			if (!field) {
				logger.warn(`Custom field with ID ${id} not found`);
				return false;
			}

			const deleted = await this.customFieldRepository.deleteCustomField(id);
			if (deleted) {
				logger.info(`Successfully deleted custom field '${field.name}'`);
			}

			return deleted;
		} catch (error) {
			logger.error(`Error deleting custom field ${id}`, error);
			throw error;
		}
	}
}
