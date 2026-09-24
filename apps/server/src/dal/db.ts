import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Logger } from '@OpsiMate/shared';
import { getDatabaseConfig } from '../config/config';

const logger = new Logger('dal/db');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function initializeDb(): Database.Database {
	const databaseConfig = getDatabaseConfig();
	const dbPath = path.isAbsolute(databaseConfig.path)
		? databaseConfig.path
		: path.resolve(__dirname, databaseConfig.path);
	logger.info(`SQLite database is connecting to ${dbPath}`);

	try {
		// Ensure the directory exists
		const dbDir = path.dirname(dbPath);
		if (!fs.existsSync(dbDir)) {
			logger.info(`Creating database directory: ${dbDir}`);
			fs.mkdirSync(dbDir, { recursive: true });
		}

		const db = new Database(dbPath);
		db.pragma('journal_mode = WAL');
		// Writers from other processes (cluster workers) are waited on for up to 5s.
		// Note for transaction authors: this only helps a transaction that takes the
		// write lock when it BEGINs. A default (DEFERRED) transaction that reads first and
		// writes later gets an immediate "database is locked" if anyone else committed in
		// between, so run read-then-write transactions with `.immediate()`.
		db.pragma('busy_timeout = 5000');
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
