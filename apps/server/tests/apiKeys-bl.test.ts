import { ApiKeyRepository } from '../src/dal/apiKeyRepository.js';
import { UserRepository } from '../src/dal/userRepository.js';
import { ApiKeyBL } from '../src/bl/apiKeys/apiKey.bl.js';
import Database from 'better-sqlite3';
import crypto from 'crypto';

describe('API Key Repository and Business Logic', () => {
  let db: Database.Database;
  let apiKeyRepo: ApiKeyRepository;
  let userRepo: UserRepository;
  let apiKeyBL: ApiKeyBL;
  let userId: number;

  beforeAll(async () => {
    db = new Database(':memory:');
    apiKeyRepo = new ApiKeyRepository(db);
    userRepo = new UserRepository(db);
    apiKeyBL = new ApiKeyBL(apiKeyRepo, userRepo);

    // Initialize tables
    await userRepo.initUsersTable();
    await apiKeyRepo.initApiKeysTable();

    // Create a test user
    const result = await userRepo.createUser(
      'test@example.com',
      'hashedpassword',
      'Test User',
      'admin'
    );
    userId = result.lastID;
  });

  beforeEach(() => {
    // Clear API keys for each test
    db.exec('DELETE FROM api_keys');
  });

  afterAll(() => {
    db.close();
  });

  describe('ApiKeyRepository', () => {
    test('should create API key with correct format', async () => {
      const result = await apiKeyRepo.createApiKey(userId, 'Test Key');

      expect(result.id).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.name).toBe('Test Key');
      expect(result.key).toMatch(/^om_/);
      expect(result.key).toHaveLength(67); // 3 (prefix) + 64 (hex)
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toBeDefined();
    });

    test('should create API key with expiration date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const expiresAt = futureDate.toISOString();

      const result = await apiKeyRepo.createApiKey(userId, 'Expiring Key', expiresAt);

      expect(result.expiresAt).toBe(expiresAt);
    });

    test('should retrieve API key by hash', async () => {
      const result = await apiKeyRepo.createApiKey(userId, 'Test Key');
      const keyHash = crypto.createHash('sha256').update(result.key).digest('hex');

      const retrieved = await apiKeyRepo.getApiKeyByHash(keyHash);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(result.id);
      expect(retrieved!.name).toBe('Test Key');
      expect(retrieved!.userId).toBe(userId);
    });

    test('should return null for invalid hash', async () => {
      const invalidHash = 'invalid_hash';
      const retrieved = await apiKeyRepo.getApiKeyByHash(invalidHash);

      expect(retrieved).toBeNull();
    });

    test('should get API keys by user ID', async () => {
      await apiKeyRepo.createApiKey(userId, 'Key 1');
      await apiKeyRepo.createApiKey(userId, 'Key 2');

      const keys = await apiKeyRepo.getApiKeysByUserId(userId);

      expect(keys).toHaveLength(2);
      expect(keys[0].name).toBe('Key 2'); // Should be ordered by created_at DESC
      expect(keys[1].name).toBe('Key 1');
    });

    test('should update API key last used timestamp', async () => {
      const result = await apiKeyRepo.createApiKey(userId, 'Test Key');
      
      await apiKeyRepo.updateApiKeyLastUsed(result.id);

      const retrieved = await apiKeyRepo.getApiKeyById(result.id);
      expect(retrieved!.lastUsedAt).toBeDefined();
    });

    test('should update API key properties', async () => {
      const result = await apiKeyRepo.createApiKey(userId, 'Original Name');

      await apiKeyRepo.updateApiKey(result.id, {
        name: 'Updated Name',
        isActive: false,
      });

      const retrieved = await apiKeyRepo.getApiKeyById(result.id);
      expect(retrieved!.name).toBe('Updated Name');
      expect(retrieved!.isActive).toBe(false);
    });

    test('should delete API key', async () => {
      const result = await apiKeyRepo.createApiKey(userId, 'To Delete');

      await apiKeyRepo.deleteApiKey(result.id);

      const retrieved = await apiKeyRepo.getApiKeyById(result.id);
      expect(retrieved).toBeNull();
    });

    test('should delete all API keys for user', async () => {
      await apiKeyRepo.createApiKey(userId, 'Key 1');
      await apiKeyRepo.createApiKey(userId, 'Key 2');

      await apiKeyRepo.deleteApiKeysByUserId(userId);

      const keys = await apiKeyRepo.getApiKeysByUserId(userId);
      expect(keys).toHaveLength(0);
    });

    test('should detect expired API key', async () => {
      const pastDate = new Date();
      pastDate.setSeconds(pastDate.getSeconds() - 1);
      const expiresAt = pastDate.toISOString();

      const result = await apiKeyRepo.createApiKey(userId, 'Expired Key', expiresAt);
      const apiKey = await apiKeyRepo.getApiKeyById(result.id);

      const isExpired = await apiKeyRepo.isApiKeyExpired(apiKey!);
      expect(isExpired).toBe(true);
    });

    test('should not detect non-expired API key as expired', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const expiresAt = futureDate.toISOString();

      const result = await apiKeyRepo.createApiKey(userId, 'Valid Key', expiresAt);
      const apiKey = await apiKeyRepo.getApiKeyById(result.id);

      const isExpired = await apiKeyRepo.isApiKeyExpired(apiKey!);
      expect(isExpired).toBe(false);
    });

    test('should not detect API key without expiration as expired', async () => {
      const result = await apiKeyRepo.createApiKey(userId, 'No Expiration Key');
      const apiKey = await apiKeyRepo.getApiKeyById(result.id);

      const isExpired = await apiKeyRepo.isApiKeyExpired(apiKey!);
      expect(isExpired).toBe(false);
    });
  });

  describe('ApiKeyBL', () => {
    test('should create API key with validation', async () => {
      const result = await apiKeyBL.createApiKey(userId, {
        name: 'Test Key',
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Key');
      expect(result.userId).toBe(userId);
      expect(result.key).toBeDefined();
    });

    test('should reject API key creation for non-existent user', async () => {
      await expect(
        apiKeyBL.createApiKey(99999, { name: 'Test Key' })
      ).rejects.toThrow('User not found');
    });

    test('should reject API key with past expiration date', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      const expiresAt = pastDate.toISOString();

      await expect(
        apiKeyBL.createApiKey(userId, {
          name: 'Invalid Key',
          expiresAt,
        })
      ).rejects.toThrow('Expiration date must be in the future');
    });

    test('should get API keys for user', async () => {
      await apiKeyBL.createApiKey(userId, { name: 'Key 1' });
      await apiKeyBL.createApiKey(userId, { name: 'Key 2' });

      const keys = await apiKeyBL.getApiKeysByUserId(userId);

      expect(keys).toHaveLength(2);
      expect(keys[0].name).toBe('Key 2');
      expect(keys[1].name).toBe('Key 1');
    });

    test('should get specific API key', async () => {
      const result = await apiKeyBL.createApiKey(userId, { name: 'Test Key' });

      const retrieved = await apiKeyBL.getApiKeyById(result.id, userId);

      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Test Key');
    });

    test('should return null for API key belonging to different user', async () => {
      const result = await apiKeyBL.createApiKey(userId, { name: 'Test Key' });

      const retrieved = await apiKeyBL.getApiKeyById(result.id, 99999);

      expect(retrieved).toBeNull();
    });

    test('should update API key', async () => {
      const result = await apiKeyBL.createApiKey(userId, { name: 'Original Name' });

      const updated = await apiKeyBL.updateApiKey(result.id, userId, {
        name: 'Updated Name',
        isActive: false,
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.isActive).toBe(false);
    });

    test('should reject updating API key belonging to different user', async () => {
      const result = await apiKeyBL.createApiKey(userId, { name: 'Test Key' });

      await expect(
        apiKeyBL.updateApiKey(result.id, 99999, { name: 'Hacked Name' })
      ).rejects.toThrow('API key not found');
    });

    test('should delete API key', async () => {
      const result = await apiKeyBL.createApiKey(userId, { name: 'To Delete' });

      await apiKeyBL.deleteApiKey(result.id, userId);

      const retrieved = await apiKeyBL.getApiKeyById(result.id, userId);
      expect(retrieved).toBeNull();
    });

    test('should reject deleting API key belonging to different user', async () => {
      const result = await apiKeyBL.createApiKey(userId, { name: 'Test Key' });

      await expect(
        apiKeyBL.deleteApiKey(result.id, 99999)
      ).rejects.toThrow('API key not found');
    });

    test('should validate API key', async () => {
      const result = await apiKeyBL.createApiKey(userId, { name: 'Test Key' });

      const validated = await apiKeyBL.validateApiKey(result.key);

      expect(validated).toBeDefined();
      expect(validated!.id).toBe(result.id);
      expect(validated!.name).toBe('Test Key');
    });

    test('should return null for invalid API key', async () => {
      const validated = await apiKeyBL.validateApiKey('invalid_key');

      expect(validated).toBeNull();
    });

    test('should return null for expired API key', async () => {
      const pastDate = new Date();
      pastDate.setSeconds(pastDate.getSeconds() - 1);
      const expiresAt = pastDate.toISOString();

      const result = await apiKeyBL.createApiKey(userId, {
        name: 'Expired Key',
        expiresAt,
      });

      // Wait a moment to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const validated = await apiKeyBL.validateApiKey(result.key);

      expect(validated).toBeNull();
    });

    test('should update last used timestamp when validating API key', async () => {
      const result = await apiKeyBL.createApiKey(userId, { name: 'Test Key' });

      await apiKeyBL.validateApiKey(result.key);

      const retrieved = await apiKeyBL.getApiKeyById(result.id, userId);
      expect(retrieved!.lastUsedAt).toBeDefined();
    });

    test('should delete all API keys for user', async () => {
      await apiKeyBL.createApiKey(userId, { name: 'Key 1' });
      await apiKeyBL.createApiKey(userId, { name: 'Key 2' });

      await apiKeyBL.deleteAllApiKeysForUser(userId);

      const keys = await apiKeyBL.getApiKeysByUserId(userId);
      expect(keys).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle API key generation uniqueness', async () => {
      const keys = new Set();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const result = await apiKeyRepo.createApiKey(userId, `Key ${i}`);
        keys.add(result.key);
      }

      // All keys should be unique
      expect(keys.size).toBe(iterations);
    });

    test('should handle concurrent API key operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        apiKeyBL.createApiKey(userId, { name: `Concurrent Key ${i}` })
      );

      const results = await Promise.all(promises);

      results.forEach((result: any, i: number) => {
        expect(result.name).toBe(`Concurrent Key ${i}`);
      });

      const allKeys = await apiKeyBL.getApiKeysByUserId(userId);
      expect(allKeys).toHaveLength(10);
    });

    test('should handle database constraints', async () => {
      // Test foreign key constraint
      await expect(
        apiKeyRepo.createApiKey(99999, 'Invalid User Key')
      ).rejects.toThrow();
    });
  });
});
