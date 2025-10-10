import axios, { AxiosResponse } from "axios";
import { Logger } from "@OpsiMate/shared";

const BASE_URL = "http://localhost:3001/api/v1";
const logger = new Logger("test-tags");

async function testTagsController() {
  try {
    logger.info("Testing Tags Controller...\n");

    // Test 1: Get all tags (should be empty initially)
    logger.info("1. Getting all tags (initial state)...");
    const initialTagsResponse: AxiosResponse = await axios.get(
      `${BASE_URL}/tags`,
    );
    logger.info("Initial tags: " + JSON.stringify(initialTagsResponse.data));
    if (
      initialTagsResponse.data.success &&
      initialTagsResponse.data.data.length === 0
    ) {
      logger.info(
        "✅ Initial tags retrieved successfully - database is empty\n",
      );
    } else {
      logger.info("⚠️  Database contains existing tags\n");
    }

    // Test 2: Create a new tag
    logger.info("2. Creating a new tag...");
    const tagData = {
      name: "Production",
      color: "#EF4444",
    };
    const createTagResponse: AxiosResponse = await axios.post(
      `${BASE_URL}/tags`,
      tagData,
    );
    logger.info("Tag created: " + JSON.stringify(createTagResponse.data));
    const tagId = createTagResponse.data.data.id;
    logger.info("✅ Tag created successfully\n");

    // Verify tag exists in database
    logger.info("2a. Verifying tag exists in database...");
    const verifyTagResponse: AxiosResponse = await axios.get(
      `${BASE_URL}/tags/${tagId}`,
    );
    if (
      verifyTagResponse.data.success &&
      verifyTagResponse.data.data.id === tagId
    ) {
      logger.info("✅ Tag verified in database\n");
    } else {
      logger.info("❌ Tag not found in database\n");
    }

    // Test 3: Get all tags (should now have one tag)
    logger.info("3. Getting all tags (after creation)...");
    const tagsAfterCreateResponse: AxiosResponse = await axios.get(
      `${BASE_URL}/tags`,
    );
    logger.info(
      "Tags after creation: " + JSON.stringify(tagsAfterCreateResponse.data),
    );
    if (
      tagsAfterCreateResponse.data.success &&
      tagsAfterCreateResponse.data.data.length === 1
    ) {
      logger.info(
        "✅ Tags retrieved successfully after creation - database contains 1 tag\n",
      );
    } else {
      logger.info("❌ Database state incorrect after creation\n");
    }

    // Test 4: Get tag by ID
    logger.info("4. Getting tag by ID...");
    const getTagByIdResponse: AxiosResponse = await axios.get(
      `${BASE_URL}/tags/${tagId}`,
    );
    logger.info("Tag by ID: " + JSON.stringify(getTagByIdResponse.data));
    if (
      getTagByIdResponse.data.success &&
      getTagByIdResponse.data.data.name === "Production"
    ) {
      logger.info("✅ Tag retrieved by ID successfully\n");
    } else {
      logger.info("❌ Tag by ID retrieval failed\n");
    }

    // Test 5: Update tag
    logger.info("5. Updating tag...");
    const updateData = {
      name: "Production-Updated",
      color: "#10B981",
    };
    const updateTagResponse: AxiosResponse = await axios.put(
      `${BASE_URL}/tags/${tagId}`,
      updateData,
    );
    logger.info("Tag updated: " + JSON.stringify(updateTagResponse.data));
    logger.info("✅ Tag updated successfully\n");

    // Verify update in database
    logger.info("5a. Verifying update in database...");
    const verifyUpdateResponse: AxiosResponse = await axios.get(
      `${BASE_URL}/tags/${tagId}`,
    );
    if (
      verifyUpdateResponse.data.success &&
      verifyUpdateResponse.data.data.name === "Production-Updated" &&
      verifyUpdateResponse.data.data.color === "#10B981"
    ) {
      logger.info("✅ Tag update verified in database\n");
    } else {
      logger.info("❌ Tag update not reflected in database\n");
    }

    // Test 6: Create another tag for service association tests
    logger.info("6. Creating second tag for service tests...");
    const secondTagData = {
      name: "Development",
      color: "#3B82F6",
    };
    const secondTagResponse: AxiosResponse = await axios.post(
      `${BASE_URL}/tags`,
      secondTagData,
    );
    logger.info(
      "Second tag created: " + JSON.stringify(secondTagResponse.data),
    );
    const secondTagId = secondTagResponse.data.data.id;
    logger.info("✅ Second tag created successfully\n");

    // Verify both tags exist in database
    logger.info("6a. Verifying both tags exist in database...");
    const allTagsResponse: AxiosResponse = await axios.get(`${BASE_URL}/tags`);
    if (
      allTagsResponse.data.success &&
      allTagsResponse.data.data.length === 2
    ) {
      logger.info("✅ Both tags verified in database\n");
    } else {
      logger.info("❌ Database state incorrect - should have 2 tags\n");
    }

    // ... (rest of the tests, including service association, tag removal, and validation)

    logger.info("✅ All tag controller tests completed");
  } catch (error: any) {
    logger.error(
      "❌ Tag controller test failed: " +
        (error.response?.data
          ? JSON.stringify(error.response.data)
          : error.message),
    );
  }
}

testTagsController();
