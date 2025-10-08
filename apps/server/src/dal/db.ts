import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Logger } from '@OpsiMate/shared';
import { getDatabaseConfig } from '../config/config';

const logger = new Logger('dal/db');

export function initializeDb(): Database.Database {
  const databaseConfig = getDatabaseConfig();
  const dbPath = path.isAbsolute(databaseConfig.path) 
    ? databaseConfig.path 
    : path.resolve(process.cwd(), databaseConfig.path);
  logger.info(`SQLite database is connecting to ${dbPath}`);

  try {
    // Ensure the directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      logger.info(`Creating database directory: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new Database(dbPath);
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
