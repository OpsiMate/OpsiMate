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
                'INSERT INTO secrets (secret_name, secret_path, secret_type) VALUES (?, ?, ?)'
            );

            const result = stmt.run(
                data.name,
                data.path,
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
                       secret_path AS path,
                       secret_type AS type
                FROM secrets
            `);
            return stmt.all() as SecretMetadata[];
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
                    secret_path TEXT NOT NULL,
                    secret_type TEXT NOT NULL DEFAULT 'ssh'
                )
            `).run();
        });
    }

}
