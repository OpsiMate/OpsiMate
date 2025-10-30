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

// Mock modules that use import.meta.url to avoid Jest transformation issues
jest.mock('../src/api/v1/secrets/router', () => {
    return {
        __esModule: true,
        default: jest.fn(() => {
            const express = require('express');
            return express.Router();
        })
    };
});

jest.mock('../src/api/v1/custom-fields/router', () => {
    return {
        __esModule: true,
        default: jest.fn(() => {
            const express = require('express');
            return express.Router();
        })
    };
});

jest.mock('../src/dal/sshClient', () => {
    return {
        __esModule: true,
        checkSystemServiceStatus: jest.fn().mockResolvedValue('running'),
        getDockerContainers: jest.fn().mockResolvedValue([]),
        getK8SPods: jest.fn().mockResolvedValue([]),
        executeCommand: jest.fn().mockResolvedValue(''),
        connectAndListContainers: jest.fn().mockResolvedValue([]),
    };
});

jest.mock('../src/dal/kubeConnector', () => {
    return {
        __esModule: true,
        listPods: jest.fn().mockResolvedValue([]),
        getKubeConfig: jest.fn(),
    };
});

jest.mock('../src/dal/db', () => {
    return {
        __esModule: true,
        initializeDb: jest.fn(),
        runAsync: (fn: () => any) => {
            return new Promise((resolve, reject) => {
                try {
                    const result = fn();
                    resolve(result);
                } catch (err) {
                    reject(err instanceof Error ? err : new Error(String(err)));
                }
            });
        }
    };
});

// Increase timeout for integration tests
jest.setTimeout(30000);