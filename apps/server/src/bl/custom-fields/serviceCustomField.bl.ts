import { Logger, ServiceCustomField, ServiceCustomFieldValue, User, AuditActionType, AuditResourceType } from "@OpsiMate/shared";
import { ServiceCustomFieldRepository } from "../../dal/serviceCustomFieldRepository";
import { ServiceCustomFieldValueRepository } from "../../dal/serviceCustomFieldValueRepository";
import { AuditBL } from "../audit/audit.bl";

const logger = new Logger('bl/custom-fields/serviceCustomField.bl');

export class ServiceCustomFieldBL {
    constructor(
        private customFieldRepository: ServiceCustomFieldRepository,
        private customFieldValueRepository: ServiceCustomFieldValueRepository,
        private auditBL: AuditBL
    ) {}

    // Custom Field CRUD operations
    async createCustomField(name: string, user: User): Promise<number> {
        try {
            logger.info(`Creating custom field with name: ${name}`);

            const existingField = await this.customFieldRepository.getCustomFields();
            const duplicate = existingField.find(field => field.name.toLowerCase() === name.toLowerCase());

            if (duplicate) {
                throw new Error(`Custom field with name '${name}' already exists`);
            }

            const result = await this.customFieldRepository.createCustomField({ name });
            logger.info(`Successfully created custom field '${name}' with ID: ${result.lastID}`);

            // Log the audit action
            await this.auditBL.logAction({
                actionType: AuditActionType.CREATE,
                resourceType: AuditResourceType.CUSTOM_FIELD,
                resourceId: String(result.lastID),
                userId: user.id,
                userName: user.fullName,
                resourceName: name,
                details: JSON.stringify({ 
                    name,
                    type: 'service_custom_field'
                })
            });

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

    async updateCustomField(id: number, name: string, user: User): Promise<boolean> {
        try {
            logger.info(`Updating custom field ${id} with name: ${name}`);

            const existingField = await this.customFieldRepository.getCustomFieldById(id);
            if (!existingField) {
                throw new Error(`Custom field with ID ${id} not found`);
            }

            // Check for name conflicts
            const allFields = await this.customFieldRepository.getCustomFields();
            const duplicate = allFields.find(field =>
                field.id !== id && field.name.toLowerCase() === name.toLowerCase()
            );

            if (duplicate) {
                throw new Error(`Custom field with name '${name}' already exists`);
            }

            const updated = await this.customFieldRepository.updateCustomField(id, { name });

            if (updated) {
                logger.info(`Successfully updated custom field ${id} to name '${name}'`);
                
                // Log the audit action
                await this.auditBL.logAction({
                    actionType: AuditActionType.UPDATE,
                    resourceType: AuditResourceType.CUSTOM_FIELD,
                    resourceId: String(id),
                    userId: user.id,
                    userName: user.fullName,
                    resourceName: name,
                    details: JSON.stringify({ 
                        oldName: existingField.name,
                        newName: name,
                        type: 'service_custom_field'
                    })
                });
            } else {
                logger.warn(`No changes made to custom field ${id}`);
            }

            return updated;
        } catch (error) {
            logger.error(`Error updating custom field ${id}`, error);
            throw error;
        }
    }

    async deleteCustomField(id: number, user: User): Promise<boolean> {
        try {
            logger.info(`Deleting custom field with ID: ${id}`);

            const field = await this.customFieldRepository.getCustomFieldById(id);
            if (!field) {
                logger.warn(`Custom field with ID ${id} not found`);
                return false;
            }

            // Delete all values for this custom field first
            const deletedValuesCount = await this.customFieldValueRepository.deleteAllValuesForCustomField(id);
            logger.info(`Deleted ${deletedValuesCount} custom field values for field ${id}`);

            // Then delete the custom field itself
            const deleted = await this.customFieldRepository.deleteCustomField(id);

            if (deleted) {
                logger.info(`Successfully deleted custom field '${field.name}' and all its values`);
                
                // Log the audit action
                await this.auditBL.logAction({
                    actionType: AuditActionType.DELETE,
                    resourceType: AuditResourceType.CUSTOM_FIELD,
                    resourceId: String(id),
                    userId: user.id,
                    userName: user.fullName,
                    resourceName: field.name,
                    details: JSON.stringify({ 
                        name: field.name,
                        deletedValuesCount,
                        type: 'service_custom_field'
                    })
                });
            }

            return deleted;
        } catch (error) {
            logger.error(`Error deleting custom field ${id}`, error);
            throw error;
        }
    }

    // Custom Field Value operations
    async upsertCustomFieldValue(serviceId: number, customFieldId: number, value: string): Promise<void> {
        try {
            logger.info(`Upserting custom field value for service ${serviceId}, field ${customFieldId}`);

            // Validate that the custom field exists
            const field = await this.customFieldRepository.getCustomFieldById(customFieldId);
            if (!field) {
                throw new Error(`Custom field with ID ${customFieldId} not found`);
            }

            await this.customFieldValueRepository.upsertCustomFieldValue(serviceId, customFieldId, value);
            logger.info(`Successfully upserted custom field value for service ${serviceId}, field ${customFieldId}`);
        } catch (error) {
            logger.error(`Error upserting custom field value for service ${serviceId}, field ${customFieldId}`, error);
            throw error;
        }
    }

    async getCustomFieldValuesForService(serviceId: number): Promise<ServiceCustomFieldValue[]> {
        try {
            logger.info(`Fetching custom field values for service ${serviceId}`);
            const values = await this.customFieldValueRepository.getCustomFieldValuesByServiceId(serviceId);
            logger.info(`Successfully fetched ${values.length} custom field values for service ${serviceId}`);

            return values;
        } catch (error) {
            logger.error(`Error fetching custom field values for service ${serviceId}`, error);
            throw error;
        }
    }

    async getCustomFieldValue(serviceId: number, customFieldId: number): Promise<ServiceCustomFieldValue | null> {
        try {
            logger.info(`Fetching custom field value for service ${serviceId}, field ${customFieldId}`);
            const value = await this.customFieldValueRepository.getCustomFieldValue(serviceId, customFieldId);

            if (value) {
                logger.info(`Successfully fetched custom field value for service ${serviceId}, field ${customFieldId}`);
            } else {
                logger.info(`No custom field value found for service ${serviceId}, field ${customFieldId}`);
            }

            return value;
        } catch (error) {
            logger.error(`Error fetching custom field value for service ${serviceId}, field ${customFieldId}`, error);
            throw error;
        }
    }

    async deleteCustomFieldValue(serviceId: number, customFieldId: number): Promise<boolean> {
        try {
            logger.info(`Deleting custom field value for service ${serviceId}, field ${customFieldId}`);
            const deleted = await this.customFieldValueRepository.deleteCustomFieldValue(serviceId, customFieldId);

            if (deleted) {
                logger.info(`Successfully deleted custom field value for service ${serviceId}, field ${customFieldId}`);
            } else {
                logger.warn(`No custom field value found to delete for service ${serviceId}, field ${customFieldId}`);
            }

            return deleted;
        } catch (error) {
            logger.error(`Error deleting custom field value for service ${serviceId}, field ${customFieldId}`, error);
            throw error;
        }
    }

    // Helper methods
    async getCustomFieldsWithValuesForService(serviceId: number): Promise<Record<number, string>> {
        try {
            const values = await this.getCustomFieldValuesForService(serviceId);
            const customFields: Record<number, string> = {};

            values.forEach(value => {
                customFields[value.customFieldId] = value.value;
            });

            return customFields;
        } catch (error) {
            logger.error(`Error getting custom fields with values for service ${serviceId}`, error);
            throw error;
        }
    }

    async deleteAllValuesForService(serviceId: number): Promise<number> {
        try {
            logger.info(`Deleting all custom field values for service ${serviceId}`);
            const deletedCount = await this.customFieldValueRepository.deleteAllValuesForService(serviceId);
            logger.info(`Deleted ${deletedCount} custom field values for service ${serviceId}`);

            return deletedCount;
        } catch (error) {
            logger.error(`Error deleting custom field values for service ${serviceId}`, error);
            throw error;
        }
    }
}
