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
                'INSERT INTO secrets (secret_name, secret_path) VALUES (?, ?)'
            );

            const result = stmt.run(
                data.name,
                data.path
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
                FROM secrets
            `);
            return stmt.all() as SecretMetadata[];
        });
    }

    async initSecretsMetadataTable(): Promise<void> {
        return runAsync(() => {
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS secrets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    secret_name TEXT NOT NULL,
                    secret_path TEXT NOT NULL
                )
            `).run();
        });
    }

}
