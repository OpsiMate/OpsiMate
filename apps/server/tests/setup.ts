import { vi } from 'vitest'

// Mock the Kubernetes client to avoid ES module issues
vi.mock('@kubernetes/client-node', () => ({
    KubeConfig: vi.fn().mockImplementation(() => ({
        loadFromDefault: vi.fn(),
        loadFromFile: vi.fn(),
        makeApiClient: vi.fn(),
    })),
    CoreV1Api: vi.fn(),
    AppsV1Api: vi.fn(),
    NetworkingV1Api: vi.fn(),
}));

// Increase timeout for integration tests
vi.setConfig({ testTimeout: 30000 });