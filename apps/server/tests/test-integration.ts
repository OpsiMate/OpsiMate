import axios, { AxiosResponse } from "axios";
import { Logger } from "@OpsiMate/shared";

const BASE_URL = "http://localhost:3001/api/v1";
const logger = new Logger("test-integration");

async function testIntegration() {
  try {
    logger.info("Testing Integration Router...\n");

    // Test 1: Create a provider
    logger.info("1. Creating a provider...");
    const providerData = {
      provider_name: "Test Azure VM",
      provider_ip: "192.168.1.100",
      username: "azureuser",
      public_key: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
      ssh_port: 22,
    };

    const createResponse: AxiosResponse = await axios.post(
      `${BASE_URL}/providers`,
      providerData,
    );
    logger.info("Provider created: " + JSON.stringify(createResponse.data));
    const providerId = createResponse.data.data.id;

    // Test 2: Get all providers
    logger.info("\n2. Getting all providers...");
    const providersResponse: AxiosResponse = await axios.get(
      `${BASE_URL}/providers`,
    );
    logger.info("Providers: " + JSON.stringify(providersResponse.data));

    // Test 3: Get provider instances (this will fail SSH connection but test the endpoint)
    logger.info("\n3. Getting provider instances...");
    try {
      const instancesResponse: AxiosResponse = await axios.get(
        `${BASE_URL}/providers/${providerId}/instance`,
      );
      logger.info("Instances: " + JSON.stringify(instancesResponse.data));
    } catch (error: any) {
      logger.info(
        "Expected SSH error: " +
          (error.response?.data
            ? JSON.stringify(error.response.data)
            : error.message),
      );
    }

    // Test 4: Store services in bulk
    logger.info("\n4. Storing services in bulk...");
    const servicesData = {
      serviceNames: ["nginx", "postgresql", "redis"],
    };

    const bulkResponse: AxiosResponse = await axios.post(
      `${BASE_URL}/providers/${providerId}/instance/bulk`,
      servicesData,
    );
    logger.info("Services stored: " + JSON.stringify(bulkResponse.data));

    // Test 5: Get services for provider
    logger.info("\n5. Getting services for provider...");
    const servicesResponse: AxiosResponse = await axios.get(
      `${BASE_URL}/providers/${providerId}/services`,
    );
    logger.info("Services: " + JSON.stringify(servicesResponse.data));

    logger.info("\n✅ All tests completed!");
  } catch (error: any) {
    logger.error(
      "❌ Test failed: " +
        (error.response?.data
          ? JSON.stringify(error.response.data)
          : error.message),
    );
  }
}

testIntegration();
