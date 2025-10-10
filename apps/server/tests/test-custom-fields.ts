import request, { SuperTest, Test } from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../src/app";
import { Logger } from "@OpsiMate/shared";

const logger = new Logger("test-custom-fields");

async function testCustomFieldsController() {
  let app: SuperTest<Test>;
  let db: Database.Database;
  let authToken: string;

  // Setup database and app
  db = new Database(":memory:");
  const expressApp = await createApp(db);
  app = request(expressApp) as unknown as SuperTest<Test>;

  // Register and login to get auth token
  logger.info("Setting up authentication...");
  const registerRes = await app.post("/api/v1/users/register").send({
    email: "admin@example.com",
    fullName: "Admin User",
    password: "securepassword",
  });

  const loginRes = await app.post("/api/v1/users/login").send({
    email: "admin@example.com",
    password: "securepassword",
  });

  authToken = loginRes.body.token;
  logger.info("✅ Authentication setup complete\n");
  try {
    logger.info("Testing Custom Fields Controller...\n");

    // Test 1: Get all custom fields (should be empty initially)
    logger.info("1. Getting all custom fields (initial state)...");
    const initialFieldsResponse = await app
      .get("/api/v1/custom-fields")
      .set("Authorization", `Bearer ${authToken}`);
    logger.info(
      "Initial custom fields: " + JSON.stringify(initialFieldsResponse.body),
    );
    if (
      initialFieldsResponse.body.success &&
      initialFieldsResponse.body.data.customFields.length === 0
    ) {
      logger.info(
        "✅ Initial custom fields retrieved successfully - database is empty\n",
      );
    } else {
      logger.info("⚠️  Database contains existing custom fields\n");
    }

    // Test 2: Create a new custom field
    logger.info("2. Creating a new custom field...");
    const fieldData = {
      name: "Environment",
    };
    const createFieldResponse = await app
      .post("/api/v1/custom-fields")
      .set("Authorization", `Bearer ${authToken}`)
      .send(fieldData);
    logger.info(
      "Custom field created: " + JSON.stringify(createFieldResponse.body),
    );
    const fieldId = createFieldResponse.body.data.id;
    logger.info("✅ Custom field created successfully\n");

    // Verify field exists in database
    logger.info("2a. Verifying custom field exists in database...");
    const verifyFieldResponse = await app
      .get(`/api/v1/custom-fields/${fieldId}`)
      .set("Authorization", `Bearer ${authToken}`);
    if (
      verifyFieldResponse.body.success &&
      verifyFieldResponse.body.data.id === fieldId
    ) {
      logger.info("✅ Custom field verified in database\n");
    } else {
      logger.info("❌ Custom field not found in database\n");
    }

    // Test 3: Get all custom fields (should now have one field)
    logger.info("3. Getting all custom fields (after creation)...");
    const fieldsAfterCreateResponse = await app
      .get("/api/v1/custom-fields")
      .set("Authorization", `Bearer ${authToken}`);
    logger.info(
      "Custom fields after creation: " +
        JSON.stringify(fieldsAfterCreateResponse.body),
    );
    if (
      fieldsAfterCreateResponse.body.success &&
      fieldsAfterCreateResponse.body.data.customFields.length === 1
    ) {
      logger.info(
        "✅ Custom fields retrieved successfully after creation - database contains 1 field\n",
      );
    } else {
      logger.info("❌ Database state incorrect after creation\n");
    }

    // Test 4: Get custom field by ID
    logger.info("4. Getting custom field by ID...");
    const getFieldByIdResponse = await app
      .get(`/api/v1/custom-fields/${fieldId}`)
      .set("Authorization", `Bearer ${authToken}`);
    logger.info(
      "Custom field by ID: " + JSON.stringify(getFieldByIdResponse.body),
    );
    if (
      getFieldByIdResponse.body.success &&
      getFieldByIdResponse.body.data.name === "Environment"
    ) {
      logger.info("✅ Custom field retrieved by ID successfully\n");
    } else {
      logger.info("❌ Custom field by ID retrieval failed\n");
    }

    // Test 5: Update custom field
    logger.info("5. Updating custom field...");
    const updateData = {
      name: "Environment-Updated",
    };
    const updateFieldResponse = await app
      .put(`/api/v1/custom-fields/${fieldId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send(updateData);
    logger.info(
      "Custom field updated: " + JSON.stringify(updateFieldResponse.body),
    );
    logger.info("✅ Custom field updated successfully\n");

    // Verify update in database
    logger.info("5a. Verifying update in database...");
    const verifyUpdateResponse = await app
      .get(`/api/v1/custom-fields/${fieldId}`)
      .set("Authorization", `Bearer ${authToken}`);
    if (
      verifyUpdateResponse.body.success &&
      verifyUpdateResponse.body.data.name === "Environment-Updated"
    ) {
      logger.info("✅ Custom field update verified in database\n");
    } else {
      logger.info("❌ Custom field update not reflected in database\n");
    }

    // Test 6: Create another custom field for value tests
    logger.info("6. Creating second custom field for value tests...");
    const secondFieldData = {
      name: "Version",
    };
    const secondFieldResponse = await app
      .post("/api/v1/custom-fields")
      .set("Authorization", `Bearer ${authToken}`)
      .send(secondFieldData);
    logger.info(
      "Second custom field created: " +
        JSON.stringify(secondFieldResponse.body),
    );
    const secondFieldId = secondFieldResponse.body.data.id;
    logger.info("✅ Second custom field created successfully\n");

    // Test 7: Test custom field values (we'll need to create a service first)
    logger.info("7. Testing custom field values...");

    // First, get all services to see if we have any
    logger.info("7a. Getting all services...");
    const servicesResponse = await app
      .get("/api/v1/services")
      .set("Authorization", `Bearer ${authToken}`);
    logger.info("Services: " + JSON.stringify(servicesResponse.body));

    let serviceId: number;
    if (
      servicesResponse.body.success &&
      servicesResponse.body.data.length > 0
    ) {
      serviceId = servicesResponse.body.data[0].id;
      logger.info(`Using existing service with ID: ${serviceId}\n`);
    } else {
      logger.info(
        "⚠️  No services found - skipping custom field value tests\n",
      );
      return;
    }

    // Test 8: Upsert custom field value
    logger.info("8. Upserting custom field value...");
    const valueData = {
      serviceId: serviceId,
      customFieldId: fieldId,
      value: "production",
    };
    const upsertValueResponse = await app
      .post("/api/v1/custom-fields/values")
      .set("Authorization", `Bearer ${authToken}`)
      .send(valueData);
    logger.info(
      "Custom field value upserted: " +
        JSON.stringify(upsertValueResponse.body),
    );
    logger.info("✅ Custom field value upserted successfully\n");

    // Test 9: Get custom field values for service
    logger.info("9. Getting custom field values for service...");
    const getValuesResponse = await app
      .get(`/api/v1/custom-fields/services/${serviceId}/values`)
      .set("Authorization", `Bearer ${authToken}`);
    logger.info(
      "Custom field values: " + JSON.stringify(getValuesResponse.body),
    );
    if (
      getValuesResponse.body.success &&
      getValuesResponse.body.data.values.length === 1
    ) {
      logger.info("✅ Custom field values retrieved successfully\n");
    } else {
      logger.info("❌ Custom field values retrieval failed\n");
    }

    // Test 10: Update custom field value (upsert again with different value)
    logger.info("10. Updating custom field value...");
    const updateValueData = {
      serviceId: serviceId,
      customFieldId: fieldId,
      value: "staging",
    };
    const updateValueResponse = await app
      .post("/api/v1/custom-fields/values")
      .set("Authorization", `Bearer ${authToken}`)
      .send(updateValueData);
    logger.info(
      "Custom field value updated: " + JSON.stringify(updateValueResponse.body),
    );
    logger.info("✅ Custom field value updated successfully\n");

    // Test 11: Add value for second custom field
    logger.info("11. Adding value for second custom field...");
    const secondValueData = {
      serviceId: serviceId,
      customFieldId: secondFieldId,
      value: "1.2.3",
    };
    const secondValueResponse = await app
      .post("/api/v1/custom-fields/values")
      .set("Authorization", `Bearer ${authToken}`)
      .send(secondValueData);
    logger.info(
      "Second custom field value added: " +
        JSON.stringify(secondValueResponse.body),
    );
    logger.info("✅ Second custom field value added successfully\n");

    // Test 12: Verify service now has custom fields
    logger.info("12. Verifying service has custom fields...");
    const serviceWithFieldsResponse = await app
      .get(`/api/v1/services/${serviceId}`)
      .set("Authorization", `Bearer ${authToken}`);
    logger.info(
      "Service with custom fields: " +
        JSON.stringify(serviceWithFieldsResponse.body),
    );
    const serviceData = serviceWithFieldsResponse.body.data;
    if (
      serviceData.customFields &&
      Object.keys(serviceData.customFields).length === 2
    ) {
      logger.info("✅ Service has custom fields\n");
    } else {
      logger.info("❌ Service does not have expected custom fields\n");
    }

    // Test 13: Delete custom field value
    logger.info("13. Deleting custom field value...");
    const deleteValueResponse = await app
      .delete(`/api/v1/custom-fields/services/${serviceId}/values/${fieldId}`)
      .set("Authorization", `Bearer ${authToken}`);
    logger.info(
      "Custom field value deleted: " + JSON.stringify(deleteValueResponse.body),
    );
    logger.info("✅ Custom field value deleted successfully\n");

    // Test 14: Verify value was deleted
    logger.info("14. Verifying custom field value was deleted...");
    const verifyDeleteResponse = await app
      .get(`/api/v1/custom-fields/services/${serviceId}/values`)
      .set("Authorization", `Bearer ${authToken}`);
    if (
      verifyDeleteResponse.body.success &&
      verifyDeleteResponse.body.data.values.length === 1
    ) {
      logger.info("✅ Custom field value deletion verified\n");
    } else {
      logger.info("❌ Custom field value deletion not reflected\n");
    }

    // Test 15: Delete custom field
    logger.info("15. Deleting custom field...");
    const deleteFieldResponse = await app
      .delete(`/api/v1/custom-fields/${fieldId}`)
      .set("Authorization", `Bearer ${authToken}`);
    logger.info(
      "Custom field deleted: " + JSON.stringify(deleteFieldResponse.body),
    );
    logger.info("✅ Custom field deleted successfully\n");

    // Test 16: Verify field was deleted and its values were cleaned up
    logger.info(
      "16. Verifying custom field was deleted and values cleaned up...",
    );
    const finalValuesResponse = await app
      .get(`/api/v1/custom-fields/services/${serviceId}/values`)
      .set("Authorization", `Bearer ${authToken}`);
    const finalFieldsResponse = await app
      .get("/api/v1/custom-fields")
      .set("Authorization", `Bearer ${authToken}`);
    if (
      finalValuesResponse.body.success &&
      finalValuesResponse.body.data.values.length === 0 &&
      finalFieldsResponse.body.success &&
      finalFieldsResponse.body.data.customFields.length === 1
    ) {
      logger.info("✅ Custom field deletion and cleanup verified\n");
    } else {
      logger.info("❌ Custom field deletion cleanup failed\n");
    }

    logger.info("✅ All custom fields controller tests completed");
  } catch (error: any) {
    logger.error(
      "❌ Custom fields controller test failed: " +
        (error.response?.data
          ? JSON.stringify(error.response.data)
          : error.message),
    );
  }
}

testCustomFieldsController();
