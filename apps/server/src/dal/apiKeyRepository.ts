import Database from 'better-sqlite3';
import { runAsync } from './db.js';
import { ApiKeyRow } from './models.js';
import { ApiKey, ApiKeyResponse } from '@OpsiMate/shared';
import crypto from 'crypto';

export class ApiKeyRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    async initApiKeysTable(): Promise<void> {
        return runAsync(() => {
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS api_keys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    key_hash TEXT NOT NULL,
                    last_used_at DATETIME,
                    expires_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `).run();
        });
    }

    async createApiKey(userId: number, name: string, expiresAt?: string): Promise<ApiKeyResponse> {
        return runAsync(() => {
            // Generate a secure API key
            const apiKey = this.generateApiKey();
            const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
            
            const stmt = this.db.prepare(`
                INSERT INTO api_keys (user_id, name, key_hash, expires_at) 
                VALUES (?, ?, ?, ?)
            `);
            
            const result = stmt.run(userId, name, keyHash, expiresAt);
            const apiKeyId = result.lastInsertRowid as number;
            
            return {
                id: apiKeyId,
                userId,
                name,
                lastUsedAt: undefined,
                expiresAt,
                createdAt: new Date().toISOString(),
                isActive: true,
                key: apiKey
            };
        });
    }

    async getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT * FROM api_keys 
                WHERE key_hash = ? AND is_active = 1
            `);
            const row = stmt.get(keyHash) as ApiKeyRow | undefined;
            return row ? this.toSharedApiKey(row) : null;
        });
    }

    async getApiKeysByUserId(userId: number): Promise<ApiKey[]> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT id, user_id, name, key_hash, last_used_at, expires_at, created_at, is_active
                FROM api_keys 
                WHERE user_id = ?
                ORDER BY created_at DESC
            `);
            const rows = stmt.all(userId) as ApiKeyRow[];
            return rows.map(this.toSharedApiKey);
        });
    }

    async getApiKeyById(id: number): Promise<ApiKey | null> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT * FROM api_keys WHERE id = ?
            `);
            const row = stmt.get(id) as ApiKeyRow | undefined;
            return row ? this.toSharedApiKey(row) : null;
        });
    }

    async updateApiKeyLastUsed(id: number): Promise<void> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                UPDATE api_keys 
                SET last_used_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `);
            stmt.run(id);
        });
    }

    async updateApiKey(id: number, updates: { name?: string; isActive?: boolean }): Promise<void> {
        return runAsync(() => {
            const setClauses: string[] = [];
            const values: (string | number)[] = [];

            if (updates.name !== undefined) {
                setClauses.push('name = ?');
                values.push(updates.name);
            }

            if (updates.isActive !== undefined) {
                setClauses.push('is_active = ?');
                // Explicitly convert boolean to number for SQLite (1 for true, 0 for false)
                // Use Number() for safer conversion that handles any truthy/falsy value
                values.push(updates.isActive ? 1 : 0);
            }

            if (setClauses.length === 0) {
                return;
            }

            values.push(id);
            const sql = `UPDATE api_keys SET ${setClauses.join(', ')} WHERE id = ?`;
            const stmt = this.db.prepare(sql);
            stmt.run(...values);
        });
    }

    async deleteApiKey(id: number): Promise<void> {
        return runAsync(() => {
            this.db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
        });
    }

    async deleteApiKeysByUserId(userId: number): Promise<void> {
        return runAsync(() => {
            this.db.prepare('DELETE FROM api_keys WHERE user_id = ?').run(userId);
        });
    }

    async isApiKeyExpired(apiKey: ApiKey): Promise<boolean> {
        if (!apiKey.expiresAt) {
            return false;
        }
        return new Date(apiKey.expiresAt) < new Date();
    }

    private generateApiKey(): string {
        // Generate a secure random API key with prefix for identification
        const randomBytes = crypto.randomBytes(32);
        const prefix = 'om_'; // OpsiMate prefix
        return prefix + randomBytes.toString('hex');
    }

    private toSharedApiKey = (row: ApiKeyRow): ApiKey => {
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            keyHash: row.key_hash,
            lastUsedAt: row.last_used_at,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            isActive: Boolean(row.is_active)
        };
    };
}
