export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        moduleResolution: 'bundler'
      }
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@kubernetes/client-node|@OpsiMate/shared)/)'
  ],
  moduleNameMapper: {
    '^@OpsiMate/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  // Handle ES modules
  extensionsToTreatAsEsm: ['.ts'],
  // Mock import.meta for Jest
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        moduleResolution: 'bundler'
      }
    }
  }
};