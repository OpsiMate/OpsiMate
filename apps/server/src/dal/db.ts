import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Logger } from '@OpsiMate/shared';
import { getDatabaseConfig } from '../config/config';

const logger = new Logger('dal/db');

const BUSY_TIMEOUT_MS = 5000;
const WAL_SWITCH_RETRY_MS = 50;

// Blocks the thread. Only for start-up waits, where nothing else is running yet.
function sleepSync(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isBusy(error: unknown): boolean {
	return (error as { code?: string } | null)?.code === 'SQLITE_BUSY';
}

export function applyConnectionPragmas(db: Database.Database): void {
	// Switching a database to WAL takes an exclusive lock. When another process (the
	// backend and the worker start together) is writing at that moment, SQLite returns
	// SQLITE_BUSY at once instead of waiting: this connection already holds a read lock the
	// writer will need, so waiting could deadlock, and the busy timeout is not consulted.
	// Dropping the read lock between attempts lets the writer finish, after which the
	// switch (or, once the other process made it, the no-op) goes through.
	const deadline = Date.now() + BUSY_TIMEOUT_MS;
	for (;;) {
		try {
			db.pragma('journal_mode = WAL');
			break;
		} catch (error) {
			if (!isBusy(error) || Date.now() >= deadline) throw error;
			sleepSync(WAL_SWITCH_RETRY_MS);
		}
	}
	db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
}

// Schema preparation is serialised across processes. Every repository brings its table up
// to date by looking at the current shape and then altering it ("no tags column: add
// it"). Two processes doing that at once both see the old shape, and the second ALTER
// fails with "duplicate column" — which is how a fresh install with backend and worker
// starting together used to crash one of them.
//
// The lock is a write transaction on a separate, otherwise empty database next to the
// real one. SQLite's file locking makes it a mutex the OS releases when the holder dies,
// no matter how. It is deliberately not a transaction on the real database: the schema
// steps manage their own, and one (the users rebuild) must switch foreign keys off,
// which no open transaction allows.
export const SCHEMA_LOCK_FILE = 'schema.lock';
const SCHEMA_LOCK_WAIT_MS = 5 * 60 * 1000;

export async function withSchemaLock<T>(db: Database.Database, fn: () => Promise<T>): Promise<T> {
	// An in-memory database belongs to this process alone.
	if (db.memory) return fn();
	const lockPath = path.join(path.dirname(db.name), SCHEMA_LOCK_FILE);
	const lock = new Database(lockPath);
	try {
		lock.pragma('busy_timeout = 0');
		try {
			lock.exec('BEGIN IMMEDIATE');
		} catch (error) {
			if (!isBusy(error)) throw error;
			logger.info('Another OpsiMate process is preparing the database schema, waiting for it to finish');
			lock.pragma(`busy_timeout = ${SCHEMA_LOCK_WAIT_MS}`);
			try {
				lock.exec('BEGIN IMMEDIATE');
			} catch (retryError) {
				if (!isBusy(retryError)) throw retryError;
				// The OS drops the lock with its holder, so the holder is alive and still at it.
				throw new Error(
					`Another OpsiMate process has been preparing the database schema for over ` +
						`${SCHEMA_LOCK_WAIT_MS / 60000} minutes (lock: ${lockPath}). Wait for it to finish, ` +
						'or stop it, and start again.',
					{ cause: retryError }
				);
			}
		}
		return await fn();
	} finally {
		// Nothing was written: the transaction only existed to hold the lock.
		if (lock.inTransaction) lock.exec('ROLLBACK');
		lock.close();
	}
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
