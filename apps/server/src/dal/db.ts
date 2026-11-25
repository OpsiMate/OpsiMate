import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Logger } from '@OpsiMate/shared';
import { getDatabaseConfig } from '../config/config';

const logger = new Logger('dal/db');

const BUSY_TIMEOUT_MS = 5000;

export function applyConnectionPragmas(db: Database.Database): void {
	db.pragma('journal_mode = WAL');
	db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The database file's absolute path, resolved the way the connection opens it.
export function resolveDatabasePath(): string {
	const databaseConfig = getDatabaseConfig();
	return path.isAbsolute(databaseConfig.path) ? databaseConfig.path : path.resolve(__dirname, databaseConfig.path);
}

// Where generated instance secrets live (see utils/instanceSecret): the database's own
// directory, the one every working install keeps across restarts.
export function instanceSecretsDir(): string {
	return path.dirname(resolveDatabasePath());
}

export function initializeDb(): Database.Database {
	const dbPath = resolveDatabasePath();
	logger.info(`SQLite database is connecting to ${dbPath}`);

	try {
		// Ensure the directory exists
		const dbDir = path.dirname(dbPath);
		if (!fs.existsSync(dbDir)) {
			logger.info(`Creating database directory: ${dbDir}`);
			fs.mkdirSync(dbDir, { recursive: true });
		}

		const db = new Database(dbPath);
		applyConnectionPragmas(db);
		logger.info(`SQLite database connected at ${dbPath}`);

		return db;
	} catch (error) {
		logger.error('Database connection error:', error);
		throw error;
	}
}

export function runAsync<T = unknown>(fn: () => T): Promise<T> {
	return new Promise((resolve, reject) => {
		try {
			const result = fn();
			resolve(result);
		} catch (err) {
			reject(err instanceof Error ? err : new Error(String(err)));
		}
	});
}
