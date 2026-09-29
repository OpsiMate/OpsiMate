import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { Logger } from '@OpsiMate/shared';

const logger = new Logger('config');

// The token security.api_token falls back to when nothing else configures one.
// Kept for backward compatibility: removing it outright breaks every deployment
// still relying on it (webhooks pointed at ?api_token=opsimate, compose files
// that never set their own). Removal is a planned, announced change, not this one.
// See warnIfDefaultApiToken below, which is what actually protects a fresh install.
export const DEFAULT_API_TOKEN = 'opsimate';

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
		api_token: string;
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
			welcomeTemplate?: {
				subject?: string;
				content?: string;
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
		warnIfDefaultApiToken(defaultConfig);
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

	// API_TOKEN is meant to work whether or not a config file is mounted, so it
	// has to override the file's value here too, not just the no-config-file
	// default in getDefaultConfig().
	if (process.env.API_TOKEN) {
		config.security.api_token = process.env.API_TOKEN;
	}

	warnIfDefaultApiToken(config);

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

	// Ensure mailer is properly configured if enabled
	if (config.mailer.enabled) {
		if (!config.mailer.host || !config.mailer.port || !config.mailer.auth?.user || !config.mailer.auth?.pass) {
			logger.warn('Mailer is enabled but SMTP configuration is incomplete. Email features will be disabled.');
			config.mailer.enabled = false;
		}
	}

	cachedConfig = config;
	logger.info(`Configuration loaded from ${configPath}`);
	return config;
}

// Fires whenever the effective token is still the shipped default, regardless of
// whether that came from getDefaultConfig(), a mounted config file, or the image's
// baked-in default-config.yml. This is the actual safeguard: it doesn't stop the
// token from working, but it makes running unconfigured impossible to miss in logs.
function warnIfDefaultApiToken(config: OpsimateConfig): void {
	if (config.security.api_token === DEFAULT_API_TOKEN) {
		logger.warn(
			`security.api_token is set to the default value ("${DEFAULT_API_TOKEN}"). ` +
				'Set security.api_token in your config file or the API_TOKEN environment variable to a value only you know.'
		);
	}
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
			api_token: process.env.API_TOKEN || DEFAULT_API_TOKEN,
		},
		vm: {
			try_with_sudo: process.env.VM_TRY_WITH_SUDO !== 'false',
		},
		mailer: {
			enabled: process.env.EMAIL_ENABLED === 'true',
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

export function isEmailEnabled(): boolean {
	const mailerConfig = getMailerConfig();
	return mailerConfig?.enabled === true;
}
