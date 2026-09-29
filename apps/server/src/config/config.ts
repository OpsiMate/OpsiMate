import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { Logger } from '@OpsiMate/shared';

const logger = new Logger('config');

// Which directory groups grant which OpsiMate role. Entries are full group DNs
// (cn=ops,ou=groups,dc=example,dc=com) or bare group names (ops); matching is
// case-insensitive. The highest matching role wins: admin > editor > operation > viewer.
export interface LdapRoleMapping {
	admin?: string[];
	editor?: string[];
	operation?: string[];
	viewer?: string[];
}

export interface LdapTlsConfig {
	// Verify the server certificate. Leave on; turn off only for a lab.
	rejectUnauthorized?: boolean;
	// Path to a PEM CA bundle for a private CA.
	ca_file?: string;
	// The PEM itself (set from the Settings page, where there is no file to point at).
	ca?: string;
}

// Directory login. Users sign in with their email and directory password; the
// account is created in OpsiMate on first login, with the role from role_mapping.
export interface LdapConfig {
	enabled: boolean;
	// ldap://host:389 or ldaps://host:636
	url?: string;
	// Upgrade an ldap:// connection with StartTLS before binding.
	start_tls?: boolean;
	// Service account used to look users up. Omit both for an anonymous search.
	bind_dn?: string;
	bind_password?: string;
	// Where users live, and how to find one by the email typed at login.
	search_base?: string;
	// {{email}} is replaced by the (escaped) email. Default: (mail={{email}})
	search_filter?: string;
	email_attribute?: string; // default: mail
	name_attribute?: string; // default: displayName (falls back to cn)
	// Groups: read from the user's memberOf attribute, and/or searched for.
	groups_attribute?: string; // default: memberOf
	group_search_base?: string;
	// {{dn}} is replaced by the (escaped) user DN. Default: (member={{dn}})
	group_search_filter?: string;
	role_mapping?: LdapRoleMapping;
	// Role for a directory user in none of the mapped groups. Omit to refuse them.
	default_role?: 'admin' | 'editor' | 'viewer' | 'operation';
	timeout_ms?: number; // default: 5000
	// Failed directory logins per email before OpsiMate stops asking the directory for
	// 15 minutes (protects the account from the directory's own lockout). 0 = no limit,
	// for directories without a lockout policy. Default: 5.
	login_max_failures?: number;
	tls?: LdapTlsConfig;
}

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
	ldap?: LdapConfig;
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
		defaultConfig.ldap = resolveLdapConfig(undefined);
		ldapManagedByConfig = hasLdapEnv();
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

	// Ensure mailer is properly configured if enabled
	if (config.mailer.enabled) {
		if (!config.mailer.host || !config.mailer.port || !config.mailer.auth?.user || !config.mailer.auth?.pass) {
			logger.warn('Mailer is enabled but SMTP configuration is incomplete. Email features will be disabled.');
			config.mailer.enabled = false;
		}
	}

	ldapManagedByConfig = config.ldap !== undefined || hasLdapEnv();
	config.ldap = resolveLdapConfig(config.ldap);

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
			api_token: process.env.API_TOKEN || 'opsimate',
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

export function getLdapConfig(): LdapConfig {
	return loadConfig().ldap ?? { enabled: false };
}

const LDAP_ROLES = ['admin', 'editor', 'operation', 'viewer'] as const;
type LdapRole = (typeof LDAP_ROLES)[number];

const envList = (value: string | undefined): string[] | undefined =>
	value === undefined
		? undefined
		: value
				.split(/[;|]/)
				.map((entry) => entry.trim())
				.filter(Boolean);

// The ldap section from config.yml, with LDAP_* environment variables layered on top
// (the Docker / Helm way to configure it), validated. An enabled but incomplete
// section is switched off with a warning rather than failing the boot: the local
// login keeps working and the log says what is missing.
export function resolveLdapConfig(fromFile: LdapConfig | undefined): LdapConfig {
	const env = process.env;
	const ldap: LdapConfig = { ...(fromFile ?? { enabled: false }) };
	// YAML may carry "true"/"false" as strings; only a real true (or "true") enables.
	ldap.enabled = (ldap.enabled as unknown) === true || (ldap.enabled as unknown) === 'true';
	if (env.LDAP_ENABLED !== undefined) ldap.enabled = env.LDAP_ENABLED === 'true';
	if (env.LDAP_URL) ldap.url = env.LDAP_URL;
	if (env.LDAP_START_TLS !== undefined) ldap.start_tls = env.LDAP_START_TLS === 'true';
	if (env.LDAP_BIND_DN) ldap.bind_dn = env.LDAP_BIND_DN;
	if (env.LDAP_BIND_PASSWORD) ldap.bind_password = env.LDAP_BIND_PASSWORD;
	if (env.LDAP_SEARCH_BASE) ldap.search_base = env.LDAP_SEARCH_BASE;
	if (env.LDAP_SEARCH_FILTER) ldap.search_filter = env.LDAP_SEARCH_FILTER;
	if (env.LDAP_EMAIL_ATTRIBUTE) ldap.email_attribute = env.LDAP_EMAIL_ATTRIBUTE;
	if (env.LDAP_NAME_ATTRIBUTE) ldap.name_attribute = env.LDAP_NAME_ATTRIBUTE;
	if (env.LDAP_GROUPS_ATTRIBUTE) ldap.groups_attribute = env.LDAP_GROUPS_ATTRIBUTE;
	if (env.LDAP_GROUP_SEARCH_BASE) ldap.group_search_base = env.LDAP_GROUP_SEARCH_BASE;
	if (env.LDAP_GROUP_SEARCH_FILTER) ldap.group_search_filter = env.LDAP_GROUP_SEARCH_FILTER;
	if (env.LDAP_TIMEOUT_MS) ldap.timeout_ms = Number(env.LDAP_TIMEOUT_MS);
	if (env.LDAP_LOGIN_MAX_FAILURES) ldap.login_max_failures = Number(env.LDAP_LOGIN_MAX_FAILURES);
	if (env.LDAP_TLS_REJECT_UNAUTHORIZED !== undefined) {
		ldap.tls = { ...ldap.tls, rejectUnauthorized: env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false' };
	}
	if (env.LDAP_TLS_CA_FILE) ldap.tls = { ...ldap.tls, ca_file: env.LDAP_TLS_CA_FILE };
	// Group lists: LDAP_ROLE_ADMIN_GROUPS="cn=ops,ou=groups,dc=x;sre" (; or | separated —
	// DNs contain commas).
	const mapping: LdapRoleMapping = {};
	for (const role of LDAP_ROLES) {
		// A single group written as a string instead of a list is still one group.
		const fromYaml: unknown = ldap.role_mapping?.[role];
		if (typeof fromYaml === 'string') mapping[role] = [fromYaml];
		else if (Array.isArray(fromYaml)) mapping[role] = fromYaml.map(String);
	}
	for (const role of LDAP_ROLES) {
		const groups = envList(env[`LDAP_ROLE_${role.toUpperCase()}_GROUPS`]);
		if (groups) mapping[role] = groups;
	}
	ldap.role_mapping = mapping;
	if (env.LDAP_DEFAULT_ROLE) ldap.default_role = env.LDAP_DEFAULT_ROLE as LdapRole;

	if (!ldap.enabled) return ldap;
	const problems = validateLdapConfig(ldap);
	if (problems.length > 0) {
		logger.warn(`LDAP login is enabled but misconfigured — disabled. Missing/invalid: ${problems.join(', ')}`);
		return { ...ldap, enabled: false };
	}
	if (/^ldap:\/\//i.test(ldap.url ?? '') && !ldap.start_tls) {
		logger.warn('LDAP login uses ldap:// without start_tls: passwords cross the network unencrypted');
	}
	return ldap;
}

// What stops this LDAP config from working, as short field notes; empty = usable.
// Shared by config.yml / env loading and the Settings page.
export function validateLdapConfig(ldap: LdapConfig): string[] {
	const mapping = ldap.role_mapping ?? {};
	const problems: string[] = [];
	if (!ldap.url || !/^ldaps?:\/\//i.test(ldap.url)) problems.push('url (ldap:// or ldaps://)');
	if (!ldap.search_base) problems.push('search_base');
	if (ldap.bind_dn && !ldap.bind_password) problems.push('bind_password (bind_dn is set)');
	if (ldap.default_role && !LDAP_ROLES.includes(ldap.default_role)) problems.push('default_role');
	if (ldap.search_filter && !ldap.search_filter.includes('{{email}}'))
		problems.push('search_filter must contain {{email}}');
	if (ldap.group_search_filter && !ldap.group_search_filter.includes('{{dn}}')) {
		problems.push('group_search_filter must contain {{dn}}');
	}
	if (ldap.timeout_ms !== undefined && !(Number.isFinite(ldap.timeout_ms) && ldap.timeout_ms > 0)) {
		// NaN would mean "no timeout" to the client: a hung directory would hang logins.
		problems.push('timeout_ms (a positive number of milliseconds)');
	}
	if (
		ldap.login_max_failures !== undefined &&
		!(Number.isInteger(ldap.login_max_failures) && ldap.login_max_failures >= 0)
	) {
		problems.push('login_max_failures (a whole number, 0 = no limit)');
	}
	if (ldap.tls?.ca_file && !fs.existsSync(ldap.tls.ca_file))
		problems.push(`tls.ca_file (${ldap.tls.ca_file} not found)`);
	if (ldap.start_tls && /^ldaps:\/\//i.test(ldap.url ?? '')) problems.push('start_tls (not with ldaps://)');
	const mapped = LDAP_ROLES.some((role) => (mapping[role]?.length ?? 0) > 0);
	if (!mapped && !ldap.default_role) problems.push('role_mapping or default_role (otherwise nobody may log in)');
	return problems;
}

// config.yml has an ldap section, or any LDAP_* variable is set: LDAP is then
// configured by the deployment, and the Settings page shows it read-only.
let ldapManagedByConfig = false;

export function isLdapManagedByConfig(): boolean {
	loadConfig();
	return ldapManagedByConfig;
}

const hasLdapEnv = (): boolean => Object.keys(process.env).some((key) => key.startsWith('LDAP_'));
