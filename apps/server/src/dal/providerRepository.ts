import Database from 'better-sqlite3';
import {Provider} from '@OpsiMate/shared';
import {runAsync} from "./db.js";
import {encryptPassword, decryptPassword} from '../utils/encryption';

export class ProviderRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db
    }

    async createProvider(data: Omit<Provider, 'id'>): Promise<{ lastID: number }> {
        return await runAsync<{ lastID: number }>(() => {
            const stmt = this.db.prepare(
                'INSERT INTO providers (provider_name, provider_ip, username, private_key_filename, password, ssh_port, provider_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
            );

            const result = stmt.run(
                data.name,
                data.providerIP,
                data.username,
                data.privateKeyFilename,
                encryptPassword(data.password),
                data.SSHPort,
                data.providerType
            );

            return {lastID: result.lastInsertRowid as number}
        });
    }

    async getProviderById(id: number): Promise<Provider> {
        return runAsync((): Provider => {
            const stmt = this.db.prepare(`
                SELECT id,
                       provider_name        AS name,
                       provider_ip          AS providerIP,
                       username,
                       private_key_filename AS privateKeyFilename,
                       password,
                       ssh_port             AS SSHPort,
                       created_at           AS createdAt,
                       provider_type        AS providerType
                FROM providers
                WHERE id = ?
            `);

            const result = stmt.get(id) as Provider;
            if (result && result.password) {
                result.password = decryptPassword(result.password);
            }
            return result;
        });
    }

    async getAllProviders(): Promise<Provider[]> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT id,
                       provider_name        AS name,
                       provider_ip          AS providerIP,
                       username,
                       private_key_filename AS privateKeyFilename,
                       password,
                       ssh_port             AS SSHPort,
                       created_at           AS createdAt,
                       provider_type        AS providerType
                FROM providers
                ORDER BY created_at DESC
            `);

            const results = stmt.all() as Provider[];
            return results.map(provider => {
                if (provider.password) {
                    provider.password = decryptPassword(provider.password);
                }
                return provider;
            });
        });
    }

    async deleteProvider(id: number): Promise<void> {
        return runAsync(() => {
            // todo: should be on delete cascade
            const deleteServices = this.db.prepare('DELETE FROM services WHERE provider_id = ?');
            deleteServices.run(id);

            const deleteProvider = this.db.prepare('DELETE FROM providers WHERE id = ?');
            deleteProvider.run(id);
        });
    }

    async updateProvider(id: number, data: Omit<Provider, 'id' | 'createdAt'>): Promise<void> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                UPDATE providers
                SET provider_name        = ?,
                    provider_ip          = ?,
                    username             = ?,
                    private_key_filename = ?,
                    password             = ?,
                    ssh_port             = ?,
                    provider_type        = ?
                WHERE id = ?
            `);

            stmt.run(
                data.name,
                data.providerIP,
                data.username,
                data.privateKeyFilename,
                encryptPassword(data.password),
                data.SSHPort,
                data.providerType,
                id
            );
        });
    }

    async initProvidersTable(): Promise<void> {
        return runAsync(() => {
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS providers
                (
                    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                    provider_name        TEXT NOT NULL,
                    provider_ip          TEXT     DEFAULT NULL,
                    username             TEXT     DEFAULT NULL,
                    private_key_filename TEXT,
                    password             TEXT,
                    ssh_port             INTEGER  DEFAULT 22,
                    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
                    provider_type        TEXT NOT NULL
                    CHECK (
                        (private_key_filename IS NOT NULL AND TRIM(private_key_filename) <> '')
                            OR
                        (password IS NOT NULL AND TRIM(password) <> '')
                        )
                )
            `).run();
        });
    }

}
