import Database from 'better-sqlite3';
import {SecretMetadata} from '@OpsiMate/shared';
import {runAsync} from "./db";

export class SecretsMetadataRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db
    }

    async createSecret(data: Omit<SecretMetadata, 'id'>): Promise<{ lastID: number }> {
        return await runAsync<{ lastID: number }>(() => {
            const stmt = this.db.prepare(
                'INSERT INTO secrets (secret_name, secret_filename, secret_type) VALUES (?, ?, ?)'
            );

            const result = stmt.run(
                data.name,
                data.fileName,
                data.type
            );

            return {lastID: result.lastInsertRowid as number}
        });
    }

    async getSecrets(): Promise<SecretMetadata[]> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT id,
                       secret_name AS name,
                       secret_filename AS fileName,
                       secret_type AS type
                FROM secrets
            `);
            return stmt.all() as SecretMetadata[];
        });
    }

    async getSecretById(id: number): Promise<SecretMetadata | null> {
        return runAsync(() => {
            const stmt = this.db.prepare(`
                SELECT id,
                       secret_name AS name,
                       secret_filename AS fileName,
                       secret_type AS type
                FROM secrets
                WHERE id = ?
            `);
            const result = stmt.get(id) as SecretMetadata | undefined;
            return result || null;
        });
    }

    async updateSecret(id: number, data: Partial<Omit<SecretMetadata, 'id'>>): Promise<boolean> {
        return await runAsync<boolean>(() => {
            const updates: string[] = [];
            const params: any[] = [];

            if (data.name !== undefined) {
                updates.push('secret_name = ?');
                params.push(data.name);
            }
            if (data.fileName !== undefined) {
                updates.push('secret_filename = ?');
                params.push(data.fileName);
            }
            if (data.type !== undefined) {
                updates.push('secret_type = ?');
                params.push(data.type);
            }

            if (updates.length === 0) {
                throw new Error('No fields to update');
            }

            params.push(id);
            const stmt = this.db.prepare(
                `UPDATE secrets SET ${updates.join(', ')} WHERE id = ?`
            );
            
            const result = stmt.run(...params);
            return result.changes > 0;
        });
    }

    async deleteSecret(id: number): Promise<boolean> {
        return await runAsync<boolean>(() => {
            const deleteStmt = this.db.prepare('DELETE FROM secrets WHERE id = ?');
            const result = deleteStmt.run(id);
            
            if (result.changes === 0) {
                return false;
            }

            return true;
        });
    }

    async initSecretsMetadataTable(): Promise<void> {
        return runAsync(() => {
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS secrets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    secret_name TEXT NOT NULL,
                    secret_filename TEXT NOT NULL,
                    secret_type TEXT NOT NULL DEFAULT 'ssh'
                )
            `).run();
        });
    }

}
