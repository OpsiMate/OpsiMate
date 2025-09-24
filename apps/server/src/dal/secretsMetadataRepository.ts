import Database from 'better-sqlite3';
import {SecretMetadata, SecretType} from '@OpsiMate/shared';
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
    async updateSecret(id: number, data: Partial<{
    name: string;
    type: SecretType;
    fileName: string;
}>): Promise<boolean> {
    try {
        // Build the SET clause dynamically based on provided fields
        const fields = [];
        const values = [];

        if (data.name !== undefined) {
            fields.push('secret_name = ?'); // FIXED: was 'name = ?'
            values.push(data.name);
        }

        if (data.type !== undefined) {
            fields.push('secret_type = ?'); // FIXED: was 'type = ?'
            values.push(data.type);
        }

        if (data.fileName !== undefined) {
            fields.push('secret_filename = ?'); // FIXED: was 'fileName = ?'
            values.push(data.fileName);
        }

        if (fields.length === 0) {
            return false; // Nothing to update
        }

        // Add the id parameter for WHERE clause
        values.push(id);

        // FIXED: Table name was 'secrets_metadata', should be 'secrets'
        const sql = `UPDATE secrets SET ${fields.join(', ')} WHERE id = ?`;
        
        const result = this.db.prepare(sql).run(...values); // FIXED: spread the values array
        
        return result.changes > 0;
    } catch (error) {
        console.error('Error updating secret in database:', error);
        throw error;
    }
}
}
