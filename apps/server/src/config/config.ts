import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { Logger } from '@OpsiMate/shared';

const logger = new Logger('config');

export interface OpsimateConfig {
    server: {
        port: number;
        host: string;
    };
    database: {
        path: string;
    };
    security: {
        private_keys_path: string;
    };
    vm: {
        try_with_sudo: boolean;
    };
    mailer?: {
        enabled: boolean;
        default_encoding?: string;
        host?: string;
        port?: number;
        secure?: boolean;
        from?: string;
        replyTo?: string;
        mailLinkBaseUrl?: string;
        templates?: {
            welcomeTemplate: {
				subject: string;
				content: string;
			};
        };
        auth?: {
            user: string;
            pass: string;
        };
        tls?: {
            rejectUnauthorized: boolean;
        };
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
		const defaultConfig = getDefaultConfig();
		cachedConfig = defaultConfig;
		return defaultConfig;
	}

	logger.info(`Loading config from: ${configPath}`);
	const configFile = fs.readFileSync(configPath, 'utf8');
	const config = yaml.load(configFile) as OpsimateConfig;

	// Validate required fields
	if (!config.server?.port || !config.database?.path || !config.security?.private_keys_path) {
		logger.error('Invalid config file: missing required fields');
		throw new Error(`Invalid config file: ${configPath}`);
	}

	// Set default VM config if not provided
	if (!config.vm) {
		config.vm = {
			try_with_sudo: process.env.VM_TRY_WITH_SUDO !== 'false',
		};
	}

	// Set default mailer config if not provided
	if (!config.mailer) {
		config.mailer = { enabled: false };
	}

	cachedConfig = config;
	logger.info(`Configuration loaded from ${configPath}`);
	return config;
}

function getDefaultConfig(): OpsimateConfig {
	return {
		server: {
			port: 3001,
			host: process.env.SERVER_HOST || '0.0.0.0',
		},
		database: {
			path: '../../data/database/opsimate.db',
		},
		security: {
			private_keys_path: '../../data/private-keys',
		},
		vm: {
			try_with_sudo: process.env.VM_TRY_WITH_SUDO !== 'false',
		},
		mailer: {
			enabled: true,
			host: process.env.SMTP_HOST || undefined,
			port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
			from: process.env.SMTP_FROM || undefined,
			mailLinkBaseUrl: process.env.APP_BASE_URL || undefined,
			auth: {
				user: process.env.SMTP_USER || '',
				pass: process.env.SMTP_PASS || '',
			},
		},
	};
}

// Helper function to get individual config sections
export function getServerConfig() {
	return loadConfig().server;
}

export function getDatabaseConfig() {
	return loadConfig().database;
}

export function getSecurityConfig() {
	return loadConfig().security;
}

export function getVmConfig() {
	return loadConfig().vm;
}

export function getMailerConfig() {
	return loadConfig().mailer;
}
