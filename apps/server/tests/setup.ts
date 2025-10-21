// Mock the Kubernetes client to avoid ES module issues
jest.mock('@kubernetes/client-node', () => ({
    KubeConfig: jest.fn().mockImplementation(() => ({
        loadFromDefault: jest.fn(),
        loadFromFile: jest.fn(),
        makeApiClient: jest.fn(),
    })),
    CoreV1Api: jest.fn(),
    AppsV1Api: jest.fn(),
    NetworkingV1Api: jest.fn(),
}));

// Increase timeout for integration tests
jest.setTimeout(30000);