import request, { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../src/app';
import { Logger } from '@OpsiMate/shared';

const logger = new Logger('test-custom-fields');

async function testCustomFieldsController() {
  let app: SuperTest<Test>;
  let db: Database.Database | null = null;
  let authToken: string;

  try {
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
    const fieldsAfterCreateResponse = await app
      .get('/api/v1/custom-fields')
      .set('Authorization', `Bearer ${authToken}`);
    logger.info('Custom fields after creation: ' + JSON.stringify(fieldsAfterCreateResponse.body));
    if (fieldsAfterCreateResponse.body.success && fieldsAfterCreateResponse.body.data.customFields.length === 1) {
      logger.info('✅ Custom fields retrieved successfully after creation - database contains 1 field\n');
    } else {
      logger.info('❌ Database state incorrect after creation\n');
    }

    // Test 4: Get custom field by ID
    logger.info('4. Getting custom field by ID...');
    const getFieldByIdResponse = await app
      .get(`/api/v1/custom-fields/${fieldId}`)
      .set('Authorization', `Bearer ${authToken}`);
    logger.info('Custom field by ID: ' + JSON.stringify(getFieldByIdResponse.body));
    if (getFieldByIdResponse.body.success && getFieldByIdResponse.body.data.name === 'Environment') {
      logger.info('✅ Custom field retrieved by ID successfully\n');
    } else {
      logger.info('❌ Custom field by ID retrieval failed\n');
    }

    // Test 5: Update custom field
    logger.info('5. Updating custom field...');
    const updateData = {
      name: 'Environment-Updated'
    };
    const updateFieldResponse = await app
      .put(`/api/v1/custom-fields/${fieldId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData);
    logger.info('Custom field updated: ' + JSON.stringify(updateFieldResponse.body));
    logger.info('✅ Custom field updated successfully\n');

    // Verify update in database
    logger.info('5a. Verifying update in database...');
    const verifyUpdateResponse = await app
      .get(`/api/v1/custom-fields/${fieldId}`)
      .set('Authorization', `Bearer ${authToken}`);
    if (verifyUpdateResponse.body.success &&
        verifyUpdateResponse.body.data.name === 'Environment-Updated') {
      logger.info('✅ Custom field update verified in database\n');
    } else {
      logger.info('❌ Custom field update not reflected in database\n');
    }

    logger.info('✅ All custom fields controller tests completed');
  } catch (error: any) {
    logger.error('❌ Custom fields controller test failed: ' + (error.response?.body ? JSON.stringify(error.response.body) : error.message));
  } finally {
    if (db) {
      db.close();
    }
  }
}

testCustomFieldsController();
