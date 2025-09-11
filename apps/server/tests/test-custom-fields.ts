import request, { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../src/app';
import { Logger } from '@OpsiMate/shared';

const logger = new Logger('test-custom-fields');

async function testCustomFieldsController() {
  let app: SuperTest<Test>;
  let db: Database.Database;
  let authToken: string;

  // Setup database and app
  db = new Database(':memory:');
  const expressApp = await createApp(db);
  app = request(expressApp) as unknown as SuperTest<Test>;

  // Register and login to get auth token
  logger.info('Setting up authentication...');
  const registerRes = await app.post('/api/v1/users/register').send({
    email: 'admin@example.com',
    fullName: 'Admin User',
    password: 'securepassword'
  });

  const loginRes = await app.post('/api/v1/users/login').send({
    email: 'admin@example.com',
    password: 'securepassword'
  });

  authToken = loginRes.body.token;
  logger.info('✅ Authentication setup complete\n');
  try {
    logger.info('Testing Custom Fields Controller...\n');

    // Test 1: Get all custom fields (should be empty initially)
    logger.info('1. Getting all custom fields (initial state)...');
    const initialFieldsResponse = await app
      .get('/api/v1/custom-fields')
      .set('Authorization', `Bearer ${authToken}`);
    logger.info('Initial custom fields: ' + JSON.stringify(initialFieldsResponse.body));
    if (initialFieldsResponse.body.success && initialFieldsResponse.body.data.customFields.length === 0) {
      logger.info('✅ Initial custom fields retrieved successfully - database is empty\n');
    } else {
      logger.info('⚠️  Database contains existing custom fields\n');
    }

    // Test 2: Create a new custom field
    logger.info('2. Creating a new custom field...');
    const fieldData = {
      name: 'Environment'
    };
    const createFieldResponse = await app
      .post('/api/v1/custom-fields')
      .set('Authorization', `Bearer ${authToken}`)
      .send(fieldData);
    logger.info('Custom field created: ' + JSON.stringify(createFieldResponse.body));
    const fieldId = createFieldResponse.body.data.id;
    logger.info('✅ Custom field created successfully\n');

    // Verify field exists in database
    logger.info('2a. Verifying custom field exists in database...');
    const verifyFieldResponse = await app
      .get(`/api/v1/custom-fields/${fieldId}`)
      .set('Authorization', `Bearer ${authToken}`);
    if (verifyFieldResponse.body.success && verifyFieldResponse.body.data.id === fieldId) {
      logger.info('✅ Custom field verified in database\n');
    } else {
      logger.info('❌ Custom field not found in database\n');
    }

    // Test 3: Get all custom fields (should now have one field)
    logger.info('3. Getting all custom fields (after creation)...');
    const fieldsAfterCreateResponse: AxiosResponse = await axios.get(`${BASE_URL}/custom-fields`);
    logger.info('Custom fields after creation: ' + JSON.stringify(fieldsAfterCreateResponse.data));
    if (fieldsAfterCreateResponse.data.success && fieldsAfterCreateResponse.data.data.customFields.length === 1) {
      logger.info('✅ Custom fields retrieved successfully after creation - database contains 1 field\n');
    } else {
      logger.info('❌ Database state incorrect after creation\n');
    }

    // Test 4: Get custom field by ID
    logger.info('4. Getting custom field by ID...');
    const getFieldByIdResponse: AxiosResponse = await axios.get(`${BASE_URL}/custom-fields/${fieldId}`);
    logger.info('Custom field by ID: ' + JSON.stringify(getFieldByIdResponse.data));
    if (getFieldByIdResponse.data.success && getFieldByIdResponse.data.data.name === 'Environment') {
      logger.info('✅ Custom field retrieved by ID successfully\n');
    } else {
      logger.info('❌ Custom field by ID retrieval failed\n');
    }

    // Test 5: Update custom field
    logger.info('5. Updating custom field...');
    const updateData = {
      name: 'Environment-Updated'
    };
    const updateFieldResponse: AxiosResponse = await axios.put(`${BASE_URL}/custom-fields/${fieldId}`, updateData);
    logger.info('Custom field updated: ' + JSON.stringify(updateFieldResponse.data));
    logger.info('✅ Custom field updated successfully\n');

    // Verify update in database
    logger.info('5a. Verifying update in database...');
    const verifyUpdateResponse: AxiosResponse = await axios.get(`${BASE_URL}/custom-fields/${fieldId}`);
    if (verifyUpdateResponse.data.success && verifyUpdateResponse.data.data.name === 'Environment-Updated') {
      logger.info('✅ Custom field update verified in database\n');
    } else {
      logger.info('❌ Custom field update not reflected in database\n');
    }

    // Test 6: Create another custom field for value tests
    logger.info('6. Creating second custom field for value tests...');
    const secondFieldData = {
      name: 'Version'
    };
    const secondFieldResponse: AxiosResponse = await axios.post(`${BASE_URL}/custom-fields`, secondFieldData);
    logger.info('Second custom field created: ' + JSON.stringify(secondFieldResponse.data));
    const secondFieldId = secondFieldResponse.data.data.id;
    logger.info('✅ Second custom field created successfully\n');

    // Test 7: Test custom field values (we'll need to create a service first)
    logger.info('7. Testing custom field values...');

    // First, get all services to see if we have any
    logger.info('7a. Getting all services...');
    const servicesResponse: AxiosResponse = await axios.get(`${BASE_URL}/services`);
    logger.info('Services: ' + JSON.stringify(servicesResponse.data));

    let serviceId: number;
    if (servicesResponse.data.success && servicesResponse.data.data.length > 0) {
      serviceId = servicesResponse.data.data[0].id;
      logger.info(`Using existing service with ID: ${serviceId}\n`);
    } else {
      logger.info('⚠️  No services found - skipping custom field value tests\n');
      return;
    }

    // Test 8: Upsert custom field value
    logger.info('8. Upserting custom field value...');
    const valueData = {
      serviceId: serviceId,
      customFieldId: fieldId,
      value: 'production'
    };
    const upsertValueResponse: AxiosResponse = await axios.post(`${BASE_URL}/custom-fields/values`, valueData);
    logger.info('Custom field value upserted: ' + JSON.stringify(upsertValueResponse.data));
    logger.info('✅ Custom field value upserted successfully\n');

    // Test 9: Get custom field values for service
    logger.info('9. Getting custom field values for service...');
    const getValuesResponse: AxiosResponse = await axios.get(`${BASE_URL}/custom-fields/services/${serviceId}/values`);
    logger.info('Custom field values: ' + JSON.stringify(getValuesResponse.data));
    if (getValuesResponse.data.success && getValuesResponse.data.data.values.length === 1) {
      logger.info('✅ Custom field values retrieved successfully\n');
    } else {
      logger.info('❌ Custom field values retrieval failed\n');
    }

    // Test 10: Update custom field value (upsert again with different value)
    logger.info('10. Updating custom field value...');
    const updateValueData = {
      serviceId: serviceId,
      customFieldId: fieldId,
      value: 'staging'
    };
    const updateValueResponse: AxiosResponse = await axios.post(`${BASE_URL}/custom-fields/values`, updateValueData);
    logger.info('Custom field value updated: ' + JSON.stringify(updateValueResponse.data));
    logger.info('✅ Custom field value updated successfully\n');

    // Test 11: Add value for second custom field
    logger.info('11. Adding value for second custom field...');
    const secondValueData = {
      serviceId: serviceId,
      customFieldId: secondFieldId,
      value: '1.2.3'
    };
    const secondValueResponse: AxiosResponse = await axios.post(`${BASE_URL}/custom-fields/values`, secondValueData);
    logger.info('Second custom field value added: ' + JSON.stringify(secondValueResponse.data));
    logger.info('✅ Second custom field value added successfully\n');

    // Test 12: Verify service now has custom fields
    logger.info('12. Verifying service has custom fields...');
    const serviceWithFieldsResponse: AxiosResponse = await axios.get(`${BASE_URL}/services/${serviceId}`);
    logger.info('Service with custom fields: ' + JSON.stringify(serviceWithFieldsResponse.data));
    const serviceData = serviceWithFieldsResponse.data.data;
    if (serviceData.customFields && Object.keys(serviceData.customFields).length === 2) {
      logger.info('✅ Service has custom fields\n');
    } else {
      logger.info('❌ Service does not have expected custom fields\n');
    }

    // Test 13: Delete custom field value
    logger.info('13. Deleting custom field value...');
    const deleteValueResponse: AxiosResponse = await axios.delete(`${BASE_URL}/custom-fields/services/${serviceId}/values/${fieldId}`);
    logger.info('Custom field value deleted: ' + JSON.stringify(deleteValueResponse.data));
    logger.info('✅ Custom field value deleted successfully\n');

    // Test 14: Verify value was deleted
    logger.info('14. Verifying custom field value was deleted...');
    const verifyDeleteResponse: AxiosResponse = await axios.get(`${BASE_URL}/custom-fields/services/${serviceId}/values`);
    if (verifyDeleteResponse.data.success && verifyDeleteResponse.data.data.values.length === 1) {
      logger.info('✅ Custom field value deletion verified\n');
    } else {
      logger.info('❌ Custom field value deletion not reflected\n');
    }

    // Test 15: Delete custom field
    logger.info('15. Deleting custom field...');
    const deleteFieldResponse: AxiosResponse = await axios.delete(`${BASE_URL}/custom-fields/${fieldId}`);
    logger.info('Custom field deleted: ' + JSON.stringify(deleteFieldResponse.data));
    logger.info('✅ Custom field deleted successfully\n');

    // Test 16: Verify field was deleted and its values were cleaned up
    logger.info('16. Verifying custom field was deleted and values cleaned up...');
    const finalValuesResponse: AxiosResponse = await axios.get(`${BASE_URL}/custom-fields/services/${serviceId}/values`);
    const finalFieldsResponse: AxiosResponse = await axios.get(`${BASE_URL}/custom-fields`);
    if (finalValuesResponse.data.success && finalValuesResponse.data.data.values.length === 0 &&
        finalFieldsResponse.data.success && finalFieldsResponse.data.data.customFields.length === 1) {
      logger.info('✅ Custom field deletion and cleanup verified\n');
    } else {
      logger.info('❌ Custom field deletion cleanup failed\n');
    }

    logger.info('✅ All custom fields controller tests completed');
  } catch (error: any) {
    logger.error('❌ Custom fields controller test failed: ' + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
  }
}

testCustomFieldsController();
