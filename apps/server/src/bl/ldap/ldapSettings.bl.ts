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
		const config = this.fromRow(row);
		// A stored password that no longer decrypts (the encryption key changed) counts as none.
		return toSettings(config, 'database', config.bind_password !== undefined, row.updated_at);
	}

	async updateSettings(updates: UpdateLdapSettings, user?: User): Promise<LdapSettings> {
		if (isLdapManagedByConfig()) throw new LdapSettingsManagedError();
		const passwordNote =
			updates.bindPassword === undefined
				? ''
				: updates.bindPassword === null
					? 'password removed, '
					: 'password replaced, ';
		let applied: LdapConfig | null = null;
		// Settings and their audit row commit together (same connection, one transaction):
		// a change is never active without being recorded, nor recorded without being saved.
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
			// Where the stored password would be sent, and how, is part of what it protects:
			// pointing the server (or the bind DN, or TLS) elsewhere must come with the
			// password again, or anyone with an admin session could redirect it to a host
			// they control and press Test.
			if (current.bind_password != null && updates.bindPassword === undefined && redirectsPassword(base, next)) {
				throw new LdapSettingsValidationError([
					'bind_password (re-enter the service-account password when changing the server URL, bind DN or TLS settings)',
				]);
			}
			const password = decryptOrUndefined(bindPassword);
			if (next.enabled) {
				const problems = validateLdapConfig({ ...next, bind_password: password });
				if (problems.length > 0) throw new LdapSettingsValidationError(problems);
			}
			// The audit trail records THAT the settings changed and by whom — never the password.
			this.auditBL.logActionInTransaction({
				actionType: AuditActionType.UPDATE,
				resourceType: AuditResourceType.LDAP,
				resourceId: 'ldap-config',
				userId: user ? Number(user.id) : 0,
				userName: user?.fullName ?? 'unknown',
				resourceName: 'LDAP settings',
				details: `${passwordNote}changed: ${changedFields(base, next).join(', ') || 'nothing'}; enabled=${next.enabled}, url=${next.url ?? ''}`,
			});
			applied = { ...next, bind_password: password };
			return { settings: JSON.stringify(next), bind_password: bindPassword };
		});
		// Only once the transaction has committed.
		if (applied) this.apply(applied);

		const config = this.fromRow(saved);
		return toSettings(config, 'database', config.bind_password !== undefined, saved.updated_at);
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

// Settings that decide where, and how safely, the service-account password is sent.
const redirectsPassword = (before: LdapConfig, after: LdapConfig): boolean =>
	(before.url ?? '').toLowerCase() !== (after.url ?? '').toLowerCase() ||
	(before.bind_dn ?? '').toLowerCase() !== (after.bind_dn ?? '').toLowerCase() ||
	(before.start_tls === true) !== (after.start_tls === true) ||
	(before.tls?.rejectUnauthorized !== false) !== (after.tls?.rejectUnauthorized !== false) ||
	(before.tls?.ca ?? '') !== (after.tls?.ca ?? '');

// Names (never values) of the settings a save changed, for the audit trail: a new admin
// group or default role grants privileges and must be traceable.
const changedFields = (before: LdapConfig, after: LdapConfig): string[] => {
	const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof LdapConfig>;
	return [...keys]
		.filter((key) => key !== 'bind_password')
		.filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
		.sort();
};

const encrypt = (value: string): string => {
	const encrypted = encryptPassword(value);
	if (!encrypted) throw new Error('Failed to encrypt the LDAP password');
	return encrypted;
};

// decryptPassword hands back its input when decryption fails (a legacy-plaintext
// fallback). LDAP passwords are always stored encrypted, so getting the ciphertext back
// means "can't decrypt" (e.g. the encryption key changed): treat it as no password
// rather than bind with the ciphertext.
const decryptOrUndefined = (value: string | null): string | undefined => {
	if (value == null) return undefined;
	const decrypted = decryptPassword(value);
	if (decrypted === undefined || decrypted === value) {
		logger.warn('The saved LDAP service-account password could not be decrypted; treating it as not set');
		return undefined;
	}
	return decrypted;
};

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
	// Switched on but not in effect (e.g. the saved password no longer decrypts): the
	// server leaves LDAP login off, and the page must not claim otherwise.
	problems: config.enabled === true ? validateLdapConfig(config) : [],
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
