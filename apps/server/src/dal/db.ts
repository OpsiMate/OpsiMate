import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
// REMOVED: ESM-specific imports (fileURLToPath and dirname) that conflict with Jest's CommonJS environment.
// import { fileURLToPath } from 'node:url';
// import { dirname } from 'node:path';
import { Logger } from '@OpsiMate/shared';
import { getDatabaseConfig } from '../config/config';

const logger = new Logger('dal/db');

// REMOVED: The problematic ESM path calculation. 
// We now rely on the Node.js CommonJS global '__dirname' which is available 
// when Jest forces the code to be compiled as a CommonJS module.
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

export function initializeDb(): Database.Database {
    const databaseConfig = getDatabaseConfig();
    
    // path.resolve will use the CommonJS global __dirname as the base directory
    // if a relative path is provided in the configuration.
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
