import Database from 'better-sqlite3';
import { SecretMetadata } from '@OpsiMate/shared';
import { runAsync } from './db';

export class SecretsMetadataRepository {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	async createSecret(data: Omit<SecretMetadata, 'id'>): Promise<{ lastID: number }> {
		return await runAsync<{ lastID: number }>(() => {
			const stmt = this.db.prepare(
				'INSERT INTO secrets (secret_name, secret_filename, secret_type) VALUES (?, ?, ?)'
			);

			const result = stmt.run(data.name, data.fileName, data.type);

			return { lastID: result.lastInsertRowid as number };
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
			const updateFields: string[] = [];
			const updateValues: (string | number)[] = [];

			if (data.name !== undefined) {
				updateFields.push('secret_name = ?');
				updateValues.push(data.name);
			}
			if (data.fileName !== undefined) {
				updateFields.push('secret_filename = ?');
				updateValues.push(data.fileName);
			}
			if (data.type !== undefined) {
				updateFields.push('secret_type = ?');
				updateValues.push(data.type);
			}

			if (updateFields.length === 0) {
				return true; // No fields to update
			}

			updateValues.push(id);
			const updateStmt = this.db.prepare(`UPDATE secrets SET ${updateFields.join(', ')} WHERE id = ?`);
			const result = updateStmt.run(...updateValues);

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
			this.db
				.prepare(
					`
                CREATE TABLE IF NOT EXISTS secrets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    secret_name TEXT NOT NULL,
                    secret_filename TEXT NOT NULL,
                    secret_type TEXT NOT NULL DEFAULT 'ssh'
                )
            `
				)
				.run();
		});
	}
}
