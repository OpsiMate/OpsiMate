import * as yaml from 'js-yaml';
import * as fs from 'fs';
import {Logger} from '@OpsiMate/shared';

const logger = new Logger('config');

export interface OpsimateConfig {
    server: {
        port: number;
        host: string;
    };
    client: {
        port: number;
        api_url: string;
    };
    database: {
        path: string;
    };
    security: {
        private_keys_path: string;
    };
}

let cachedConfig: OpsimateConfig | null = null;

export function loadConfig(): OpsimateConfig {
    if (cachedConfig) {
        return cachedConfig;
    }

    const configPath: string | null = process.env.CONFIG_FILE || null;

    if (!configPath || !fs.existsSync(configPath)) {
        logger.warn(`Config file not found starting from ${process.cwd()}, using defaults`);
        return getDefaultConfig();
    }

    logger.info(`Loading config from: ${configPath}`);
    const configFile = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(configFile) as OpsimateConfig;

    // Validate required fields
    if (!config.server?.port || !config.database?.path || !config.security?.private_keys_path) {
        logger.error('Invalid config file: missing required fields');
        throw new Error(`Invalid config file: ${configPath}`);
    }

    cachedConfig = config;
    logger.info(`Configuration loaded from ${configPath}`);
    return config;
}

function getDefaultConfig(): OpsimateConfig {
    return {
        server: {
            port: 3001,
            host: 'localhost'
        },
        client: {
            port: 8080,
            api_url: 'http://localhost:3001/api/v1'
        },
        database: {
            path: '../../data/database/opsimate.db'
        },
        security: {
            private_keys_path: '../../data/private-keys'
        }
    };
}

// Helper function to get individual config sections
export function getServerConfig() {
    return loadConfig().server;
}

export function getClientConfig() {
    return loadConfig().client;
}

export function getDatabaseConfig() {
    return loadConfig().database;
}

export function getSecurityConfig() {
    return loadConfig().security;
}
