import {
	AuditActionType,
	AuditResourceType,
	LdapRoleGroups,
	LdapSettings,
	LdapSettingsSource,
	LdapTestResult,
	Logger,
	Role,
	UpdateLdapSettings,
	User,
} from '@OpsiMate/shared';
import { getLdapConfig, isLdapManagedByConfig, LdapConfig, validateLdapConfig } from '../../config/config';
import { LdapConfigRepository, LdapConfigRow } from '../../dal/ldapConfigRepository';
import { decryptPassword, encryptPassword } from '../../utils/encryption';
import { AuditBL } from '../audit/audit.bl';
import { LdapAuthenticator } from '../users/ldapAuthenticator';
import { DEFAULT_LDAP_MAX_FAILURES, UserBL } from '../users/user.bl';

const logger = new Logger('bl/ldap/ldapSettings');

const DEFAULT_SEARCH_FILTER = '(mail={{email}})';
const DEFAULT_GROUP_SEARCH_FILTER = '(member={{dn}})';
const DEFAULT_TIMEOUT_MS = 5000;

// config.yml / LDAP_* env configure LDAP: the page can only show it.
export class LdapSettingsManagedError extends Error {
	constructor() {
		super('LDAP is configured in config.yml or LDAP_* environment variables on the server; change it there.');
		this.name = 'LdapSettingsManagedError';
	}
}

// The saved settings can't be enabled as they stand.
export class LdapSettingsValidationError extends Error {
	constructor(readonly problems: string[]) {
		super(`LDAP settings are incomplete or invalid: ${problems.join(', ')}`);
		this.name = 'LdapSettingsValidationError';
	}
}

// Directory login settings from the Settings page. They live in the database (the
// service-account password encrypted), apply the moment they are saved, and are
// overridden entirely by config.yml / LDAP_* env when those are present.
export class LdapSettingsBL {
	constructor(
		private readonly repo: LdapConfigRepository,
		private readonly userBL: UserBL,
		private readonly auditBL: AuditBL
	) {}

	// At startup: switch on whichever configuration applies.
	async init(): Promise<void> {
		if (isLdapManagedByConfig()) {
			const config = getLdapConfig();
			this.apply(config);
			if (config.enabled) logger.info(`LDAP login enabled from server configuration (${config.url})`);
			return;
		}
		const config = this.fromRow(await this.repo.getConfig());
		if (!config.enabled) return;
		const problems = validateLdapConfig(config);
		if (problems.length > 0) {
			logger.warn(
				`Saved LDAP settings are invalid — LDAP login stays off. Missing/invalid: ${problems.join(', ')}`
			);
			return;
		}
		this.apply(config);
		logger.info(`LDAP login enabled from saved settings (${config.url})`);
	}

	async getSettings(): Promise<LdapSettings> {
		if (isLdapManagedByConfig()) {
			const config = getLdapConfig();
			return toSettings(config, 'config', Boolean(config.bind_password), null);
		}
		const row = await this.repo.getConfig();
		return toSettings(this.fromRow(row), 'database', row.bind_password != null, row.updated_at);
	}

	async updateSettings(updates: UpdateLdapSettings, user?: User): Promise<LdapSettings> {
		if (isLdapManagedByConfig()) throw new LdapSettingsManagedError();
		let applied: LdapConfig | null = null;
		const saved = await this.repo.mergeConfig((current) => {
			const base = parseSettings(current.settings);
			const next = mergeUpdates(base, updates);
			// undefined keeps the stored ciphertext, null removes it, a string replaces it.
			const bindPassword =
				updates.bindPassword === undefined
					? current.bind_password
					: updates.bindPassword === null
						? null
						: encrypt(updates.bindPassword);
			if (next.enabled) {
				const problems = validateLdapConfig({ ...next, bind_password: decryptOrUndefined(bindPassword) });
				if (problems.length > 0) throw new LdapSettingsValidationError(problems);
			}
			applied = { ...next, bind_password: decryptOrUndefined(bindPassword) };
			return { settings: JSON.stringify(next), bind_password: bindPassword };
		});
		if (applied) this.apply(applied);

		const config = this.fromRow(saved);
		const passwordNote =
			updates.bindPassword === undefined
				? ''
				: updates.bindPassword === null
					? 'password removed, '
					: 'password replaced, ';
		// The audit trail records THAT the settings changed and by whom — never the password.
		await this.auditBL.logAction({
			actionType: AuditActionType.UPDATE,
			resourceType: AuditResourceType.LDAP,
			resourceId: 'ldap-config',
			userId: user ? Number(user.id) : 0,
			userName: user?.fullName ?? 'unknown',
			resourceName: 'LDAP settings',
			details: `${passwordNote}enabled=${config.enabled}, url=${config.url ?? ''}`,
		});
		return toSettings(config, 'database', saved.bind_password != null, saved.updated_at);
	}

	// Test the settings as they are SAVED (enabled or not): what was verified is what
	// is stored. Optionally look up one user and report the role they would get.
	async test(email?: string): Promise<LdapTestResult> {
		const config = isLdapManagedByConfig() ? getLdapConfig() : this.fromRow(await this.repo.getConfig());
		if (!config.url || !config.search_base) {
			return {
				ok: false,
				latencyMs: 0,
				steps: [{ step: 'connect', ok: false, message: 'Save a server URL and a search base first.' }],
				user: null,
			};
		}
		if (config.bind_dn && !config.bind_password) {
			return {
				ok: false,
				latencyMs: 0,
				steps: [{ step: 'service_bind', ok: false, message: 'A bind DN is set but no password is saved.' }],
				user: null,
			};
		}
		try {
			return await new LdapAuthenticator(config).probe(email);
		} catch (error) {
			return {
				ok: false,
				latencyMs: 0,
				steps: [{ step: 'connect', ok: false, message: (error as Error).message }],
				user: null,
			};
		}
	}

	private apply(config: LdapConfig): void {
		this.userBL.setLdapAuthenticator(
			config.enabled ? new LdapAuthenticator(config) : null,
			config.login_max_failures ?? DEFAULT_LDAP_MAX_FAILURES
		);
	}

	private fromRow(row: LdapConfigRow): LdapConfig {
		return { ...parseSettings(row.settings), bind_password: decryptOrUndefined(row.bind_password) };
	}
}

const encrypt = (value: string): string => {
	const encrypted = encryptPassword(value);
	if (!encrypted) throw new Error('Failed to encrypt the LDAP password');
	return encrypted;
};

const decryptOrUndefined = (value: string | null): string | undefined =>
	value == null ? undefined : decryptPassword(value);

const parseSettings = (json: string): LdapConfig => {
	try {
		const parsed = JSON.parse(json) as LdapConfig;
		// The password never lives in this JSON; drop one if an old row had it.
		delete parsed.bind_password;
		return { ...parsed, enabled: parsed.enabled === true };
	} catch {
		return { enabled: false };
	}
};

const blankToUndefined = (value: string | undefined): string | undefined =>
	value === undefined || value.trim() === '' ? undefined : value.trim();

// Apply a partial update from the page onto stored settings. Empty strings clear a
// field (so defaults apply again).
const mergeUpdates = (base: LdapConfig, updates: UpdateLdapSettings): LdapConfig => {
	const next: LdapConfig = { ...base };
	const setText = (key: keyof LdapConfig, value: string | undefined): void => {
		if (value === undefined) return;
		(next as Record<string, unknown>)[key] = blankToUndefined(value);
	};
	if (updates.enabled !== undefined) next.enabled = updates.enabled;
	setText('url', updates.url);
	if (updates.startTls !== undefined) next.start_tls = updates.startTls;
	setText('bind_dn', updates.bindDn);
	setText('search_base', updates.searchBase);
	setText('search_filter', updates.searchFilter);
	setText('email_attribute', updates.emailAttribute);
	setText('name_attribute', updates.nameAttribute);
	setText('groups_attribute', updates.groupsAttribute);
	setText('group_search_base', updates.groupSearchBase);
	setText('group_search_filter', updates.groupSearchFilter);
	if (updates.roleMapping !== undefined) next.role_mapping = { ...updates.roleMapping };
	if (updates.defaultRole !== undefined) next.default_role = updates.defaultRole ?? undefined;
	if (updates.timeoutMs !== undefined) next.timeout_ms = updates.timeoutMs;
	if (updates.loginMaxFailures !== undefined) next.login_max_failures = updates.loginMaxFailures;
	if (updates.tlsRejectUnauthorized !== undefined || updates.tlsCaCert !== undefined) {
		next.tls = {
			...next.tls,
			...(updates.tlsRejectUnauthorized !== undefined
				? { rejectUnauthorized: updates.tlsRejectUnauthorized }
				: {}),
			...(updates.tlsCaCert !== undefined ? { ca: blankToUndefined(updates.tlsCaCert) } : {}),
		};
	}
	return next;
};

const groupsFor = (config: LdapConfig): LdapRoleGroups => ({
	admin: [...(config.role_mapping?.admin ?? [])],
	editor: [...(config.role_mapping?.editor ?? [])],
	operation: [...(config.role_mapping?.operation ?? [])],
	viewer: [...(config.role_mapping?.viewer ?? [])],
});

const toSettings = (
	config: LdapConfig,
	source: LdapSettingsSource,
	hasBindPassword: boolean,
	updatedAt: string | null
): LdapSettings => ({
	source,
	enabled: config.enabled === true,
	url: config.url ?? '',
	startTls: config.start_tls === true,
	bindDn: config.bind_dn ?? '',
	hasBindPassword,
	searchBase: config.search_base ?? '',
	searchFilter: config.search_filter ?? DEFAULT_SEARCH_FILTER,
	emailAttribute: config.email_attribute ?? 'mail',
	nameAttribute: config.name_attribute ?? 'displayName',
	groupsAttribute: config.groups_attribute ?? 'memberOf',
	groupSearchBase: config.group_search_base ?? '',
	groupSearchFilter: config.group_search_filter ?? DEFAULT_GROUP_SEARCH_FILTER,
	roleMapping: groupsFor(config),
	defaultRole: (config.default_role as Role | undefined) ?? null,
	timeoutMs: config.timeout_ms ?? DEFAULT_TIMEOUT_MS,
	loginMaxFailures: config.login_max_failures ?? DEFAULT_LDAP_MAX_FAILURES,
	tlsRejectUnauthorized: config.tls?.rejectUnauthorized !== false,
	// A file-based CA is shown by path; the page only edits inline PEMs.
	tlsCaCert: config.tls?.ca ?? (config.tls?.ca_file ? `(file) ${config.tls.ca_file}` : ''),
	updatedAt,
});
