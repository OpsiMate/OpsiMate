import { ApiKeyRepository } from '../../dal/apiKeyRepository.js';
import { UserRepository } from '../../dal/userRepository.js';
import { ApiKey, CreateApiKeyRequest, ApiKeyResponse, AuditActionType, AuditResourceType } from '@OpsiMate/shared';
import { AuditBL } from '../audit/audit.bl.js';

export class ApiKeyBL {
    constructor(
        private apiKeyRepo: ApiKeyRepository,
        private userRepo: UserRepository,
        private auditBL?: AuditBL
    ) {}

    async createApiKey(userId: number, request: CreateApiKeyRequest): Promise<ApiKeyResponse> {
        // Validate user exists
        const user = await this.userRepo.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Check if user already has too many API keys (security limit)
        const existingKeys = await this.apiKeyRepo.getApiKeysByUserId(userId);
        const MAX_API_KEYS_PER_USER = 50;
        if (existingKeys.length >= MAX_API_KEYS_PER_USER) {
            throw new Error(`Maximum number of API keys (${MAX_API_KEYS_PER_USER}) reached. Please delete unused keys.`);
        }

        // Check for duplicate names within user's keys
        const duplicateName = existingKeys.find(key => key.name.toLowerCase() === request.name.toLowerCase());
        if (duplicateName) {
            throw new Error('An API key with this name already exists. Please choose a different name.');
        }

        // Validate expiration date if provided (with reasonable limits)
        if (request.expiresAt) {
            const expirationDate = new Date(request.expiresAt);
            const now = new Date();
            
            if (expirationDate <= now) {
                throw new Error('Expiration date must be in the future');
            }

            // Prevent setting expiration too far in the future (e.g., max 10 years)
            const maxYearsInFuture = 10;
            const maxDate = new Date();
            maxDate.setFullYear(maxDate.getFullYear() + maxYearsInFuture);
            
            if (expirationDate > maxDate) {
                throw new Error(`Expiration date cannot be more than ${maxYearsInFuture} years in the future`);
            }
        }

        const apiKeyResponse = await this.apiKeyRepo.createApiKey(userId, request.name, request.expiresAt);

        // Log audit action
        if (this.auditBL) {
            await this.auditBL.logAction({
                actionType: AuditActionType.CREATE,
                resourceType: AuditResourceType.USER, // API keys are user-related
                resourceId: String(apiKeyResponse.id),
                userId,
                userName: user.fullName,
                resourceName: `API Key: ${request.name}`,
                details: `Created new API key${request.expiresAt ? ` with expiration: ${request.expiresAt}` : ' (no expiration)'}`,
            });
        }

        return apiKeyResponse;
    }

    async getApiKeysByUserId(userId: number): Promise<ApiKey[]> {
        return await this.apiKeyRepo.getApiKeysByUserId(userId);
    }

    async getApiKeyById(id: number, userId: number): Promise<ApiKey | null> {
        const apiKey = await this.apiKeyRepo.getApiKeyById(id);
        if (!apiKey || apiKey.userId !== userId) {
            return null;
        }
        return apiKey;
    }

    async updateApiKey(id: number, userId: number, updates: { name?: string; isActive?: boolean }): Promise<ApiKey> {
        // Verify ownership
        const existingApiKey = await this.apiKeyRepo.getApiKeyById(id);
        if (!existingApiKey || existingApiKey.userId !== userId) {
            throw new Error('API key not found');
        }

        await this.apiKeyRepo.updateApiKey(id, updates);
        const updatedApiKey = await this.apiKeyRepo.getApiKeyById(id);
        if (!updatedApiKey) {
            throw new Error('API key not found');
        }

        // Log audit action
        if (this.auditBL) {
            const user = await this.userRepo.getUserById(userId);
            if (user) {
                const details = updates.isActive !== undefined 
                    ? `API key ${updates.isActive ? 'activated' : 'deactivated'}`
                    : 'API key updated';
                
                await this.auditBL.logAction({
                    actionType: AuditActionType.UPDATE,
                    resourceType: AuditResourceType.USER,
                    resourceId: String(id),
                    userId,
                    userName: user.fullName,
                    resourceName: `API Key: ${updatedApiKey.name}`,
                    details,
                });
            }
        }

        return updatedApiKey;
    }

    async deleteApiKey(id: number, userId: number): Promise<void> {
        // Verify ownership
        const existingApiKey = await this.apiKeyRepo.getApiKeyById(id);
        if (!existingApiKey || existingApiKey.userId !== userId) {
            throw new Error('API key not found');
        }

        await this.apiKeyRepo.deleteApiKey(id);

        // Log audit action
        if (this.auditBL) {
            const user = await this.userRepo.getUserById(userId);
            if (user) {
                await this.auditBL.logAction({
                    actionType: AuditActionType.DELETE,
                    resourceType: AuditResourceType.USER,
                    resourceId: String(id),
                    userId,
                    userName: user.fullName,
                    resourceName: `API Key: ${existingApiKey.name}`,
                    details: 'API key deleted',
                });
            }
        }
    }

    async validateApiKey(apiKey: string): Promise<ApiKey | null> {
        // Validate API key format (must start with om_ and be correct length)
        if (!apiKey || typeof apiKey !== 'string') {
            return null;
        }

        const API_KEY_PREFIX = 'om_';
        const EXPECTED_LENGTH = 67; // 'om_' (3) + 64 hex characters

        if (!apiKey.startsWith(API_KEY_PREFIX) || apiKey.length !== EXPECTED_LENGTH) {
            return null;
        }

        // Validate that the hex portion is actually hex
        const hexPortion = apiKey.slice(API_KEY_PREFIX.length);
        if (!/^[a-f0-9]{64}$/.test(hexPortion)) {
            return null;
        }

        const crypto = await import('crypto');
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        
        const apiKeyData = await this.apiKeyRepo.getApiKeyByHash(keyHash);
        if (!apiKeyData) {
            return null;
        }

        // Check if API key is active
        if (!apiKeyData.isActive) {
            return null;
        }

        // Check if API key is expired
        if (await this.apiKeyRepo.isApiKeyExpired(apiKeyData)) {
            return null;
        }

        // Update last used timestamp (async, don't block)
        this.apiKeyRepo.updateApiKeyLastUsed(apiKeyData.id).catch(error => {
            console.error('Failed to update API key last used timestamp:', error);
        });

        return apiKeyData;
    }

    async deleteAllApiKeysForUser(userId: number): Promise<void> {
        await this.apiKeyRepo.deleteApiKeysByUserId(userId);
    }

    async getUserById(userId: number) {
        return await this.userRepo.getUserById(userId);
    }
}
