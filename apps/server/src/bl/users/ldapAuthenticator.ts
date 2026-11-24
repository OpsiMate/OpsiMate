import fs from 'node:fs';
import net from 'node:net';
import type { ConnectionOptions } from 'node:tls';
import { Client, ClientOptions, Entry, InvalidCredentialsError, ResultCodeError } from 'ldapts';
import {
	foldUsername,
	LdapTestResult,
	LdapTestStep,
	LdapTestUser,
	Logger,
	Role,
	usernameFromEmail,
} from '@OpsiMate/shared';
import { LdapConfig, LdapRoleMapping } from '../../config/config';
import { MS_PER_SECOND } from '../../utils/time';

export const DEFAULT_LDAP_TIMEOUT_MS = 5 * MS_PER_SECOND;

const logger = new Logger('bl/users/ldapAuthenticator');

// Who the directory says the person is, after their password checked out.
export interface LdapIdentity {
	dn: string;
	// The directory object's stable id (entryUUID on OpenLDAP/FreeIPA, objectGUID on Active
	// Directory, as hex), which survives renames and is never reused for a new entry at
	// the same DN; null when the directory exposes neither.
	objectId: string | null;
	// The login name OpsiMate keys the account on: the entry's username attribute (uid /
	// sAMAccountName), falling back to its address's local part.
	username: string;
	// The entry's first address; null for an entry with no address.
	email: string | null;
	fullName: string;
	// Group DNs (or names) the user belongs to.
	groups: string[];
	// The OpsiMate role their groups map to; null = in no mapped group and no default.
	role: Role | null;
}

// Who may still try to bind: the caller's failure counter, keyed on the directory entry
// (its DN), so a username and an email that name the same account share one budget —
// before the account has an OpsiMate row as much as after.
export interface LdapBindGuard {
	// Reserves an attempt, or refuses: the account is over its budget.
	allow(dn: string): boolean;
	// The directory said the password was wrong: the reservation is a failure now.
	failed(dn: string): void;
	// The password never reached a verdict (the connection broke before or during the
	// bind): the reservation is given back, the directory counted nothing.
	abandoned(dn: string): void;
	succeeded(dn: string): void;
}

// ldapts's words for a request that was never written to the directory: no socket to
// send on, or the connection attempt itself failed (refused, no route, timed out
// connecting). "Operation timed out" and "Connection closed before message response"
// are after sending and are NOT here.
const STARTTLS_RECONNECT_REFUSED = 'LDAP connection dropped after StartTLS; not reconnecting in clear';
const BIND_NEVER_SENT = new RegExp(
	[
		'Socket connection not established',
		'^Connection timeout$',
		'ECONNREFUSED',
		'ENOTFOUND',
		'EHOSTUNREACH',
		'ENETUNREACH',
		'EAI_AGAIN',
		STARTTLS_RECONNECT_REFUSED,
	].join('|')
);
// Whether a failed bind was never written. An LDAP result (ResultCodeError) is the
// directory's own answer — it saw the bind — whatever diagnostic text it carries.
const bindNeverSent = (error: unknown): boolean =>
	!(error instanceof ResultCodeError) && BIND_NEVER_SENT.test(error instanceof Error ? error.message : String(error));

// The guard refused the bind: too many failures for this directory account.
export class LdapThrottledError extends Error {
	constructor(dn: string) {
		super(`Too many failed logins for ${dn}`);
		this.name = 'LdapThrottledError';
	}
}

// The directory could not be asked (down, TLS failure, bad service account): not the
// same as "wrong password", and reported differently so the login page can say so.
export class LdapUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LdapUnavailableError';
	}
}

// The parts of an ldapts Client this module uses — the seam tests replace.
export interface LdapClientLike {
	startTLS(options?: ConnectionOptions): Promise<void>;
	bind(dn: string, password?: string): Promise<void>;
	search(baseDN: string, options: LdapSearchOptions): Promise<LdapSearchResult>;
	unbind(): Promise<void>;
}

export interface LdapSearchOptions {
	scope: 'base' | 'one' | 'sub';
	filter: string;
	attributes: string[];
	sizeLimit?: number;
	// Attributes to hand back as raw bytes (ldapts would otherwise decode them as UTF-8).
	explicitBufferAttributes?: string[];
}

export interface LdapSearchResult {
	searchEntries: Entry[];
}

export type LdapClientFactory = (options: ClientOptions) => LdapClientLike;

const defaultClientFactory: LdapClientFactory = (options) => new Client(options);

// What was typed is an email when it has an "@"; otherwise a username.
const isEmailLike = (identifier: string): boolean => identifier.includes('@');

// The directory attributes a login is matched against when the config names none, and
// the filter built from them. Shared with the Settings page, which shows these defaults.
export const DEFAULT_USERNAME_ATTRIBUTE = 'uid';
export const DEFAULT_EMAIL_ATTRIBUTE = 'mail';
// A configured attribute name, trimmed; blank or absent means the default.
const attributeName = (configured: string | undefined, fallback: string): string =>
	(configured ?? fallback).trim() || fallback;

export const defaultSearchFilter = (config: Pick<LdapConfig, 'username_attribute' | 'email_attribute'>): string =>
	`(|(${attributeName(config.username_attribute, DEFAULT_USERNAME_ATTRIBUTE)}={{login}})(${attributeName(config.email_attribute, DEFAULT_EMAIL_ATTRIBUTE)}={{login}}))`;

// RFC 4515 escaping for a value placed inside a search filter: without it a login
// like "*)(uid=*" would rewrite the filter (LDAP injection).
export const escapeFilterValue = (value: string): string =>
	value.replace(/[\\*()\0]/g, (ch) => `\\${ch.charCodeAt(0).toString(16).padStart(2, '0')}`);

const ROLE_PRIORITY: Role[] = [Role.Admin, Role.Editor, Role.Operation, Role.Viewer];

// First component value of a DN: "cn=Ops Team,ou=groups,dc=x" -> "ops team".
const leafName = (dn: string): string => {
	const first = dn.split(',')[0] ?? '';
	const eq = first.indexOf('=');
	return (eq >= 0 ? first.slice(eq + 1) : first).trim().toLowerCase();
};

// The highest role any of the user's groups grants. A mapping entry is a full group
// DN (compared whole) or a bare group name (compared with the group's leaf name);
// both case-insensitive.
export const resolveLdapRole = (
	groups: string[],
	mapping: LdapRoleMapping | undefined,
	defaultRole: string | undefined
): Role | null => {
	const dns = new Set(groups.map((g) => g.trim().toLowerCase()));
	const names = new Set(groups.map(leafName));
	for (const role of ROLE_PRIORITY) {
		const entries = mapping?.[role] ?? [];
		const hit = entries.some((entry) => {
			const e = entry.trim().toLowerCase();
			return e.includes('=') ? dns.has(e) : names.has(e);
		});
		if (hit) return role;
	}
	return defaultRole && (ROLE_PRIORITY as string[]).includes(defaultRole) ? (defaultRole as Role) : null;
};

// LDAP attribute names are case-insensitive and the server answers in its own spelling
// (sAMAccountName for a configured samaccountname): the entry is read by name ignoring case.
const rawAttribute = (entry: Entry, attribute: string): unknown => {
	const wanted = attribute.toLowerCase();
	const key = Object.keys(entry).find((name) => name.toLowerCase() === wanted);
	return key === undefined ? undefined : entry[key];
};

const asText = (value: unknown): string => (Buffer.isBuffer(value) ? value.toString('utf8') : String(value));

// The operational attributes that identify a directory object for good: OpenLDAP and
// FreeIPA expose entryUUID, Active Directory objectGUID (16 bytes, read as hex). Both
// are asked for; whichever the server returns becomes the identity's objectId.
const OBJECT_ID_ATTRIBUTES = ['entryUUID', 'objectGUID'] as const;
// Active Directory's objectGUID, in one form whatever the directory hands over: the 16
// raw bytes (asked for as such, see findEntries; the first three fields little-endian, as
// Windows writes them), or the standard text — braces or not, as text or as the bytes of
// that text. Anything else — the 16 bytes decoded as UTF-8, which is lossy, so two
// objects could read the same — is no id at all, and the account is linked by DN.
const GUID_TEXT = /^\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?$/i;
const guidTextOf = (value: unknown): string | null => {
	if (Buffer.isBuffer(value) && value.length === 16) {
		const hex = (from: number, to: number, littleEndian: boolean) => {
			const bytes = Buffer.from(value.subarray(from, to));
			return (littleEndian ? bytes.reverse() : bytes).toString('hex');
		};
		return `${hex(0, 4, true)}-${hex(4, 6, true)}-${hex(6, 8, true)}-${hex(8, 10, false)}-${hex(10, 16, false)}`;
	}
	const text = Buffer.isBuffer(value) ? value.toString('latin1') : typeof value === 'string' ? value : '';
	const match = GUID_TEXT.exec(text.trim());
	return match ? match[1].toLowerCase() : null;
};
const OBJECT_GUID_SPELLINGS = ['objectGUID', 'objectguid', 'OBJECTGUID', 'ObjectGUID', 'ObjectGuid'];
// Said once per process: a GUID that cannot be read means accounts are linked by DN
// only, which is worth knowing without flooding the log at every login.
let warnedUnreadableGuid = false;
const objectIdOf = (entry: Entry): string | null => {
	const uuid = rawAttribute(entry, 'entryUUID');
	const first = (value: unknown): unknown => (Array.isArray(value) ? (value as unknown[])[0] : value);
	const uuidValue = first(uuid);
	if (uuidValue !== undefined && uuidValue !== null && uuidValue !== '')
		return asText(uuidValue).trim().toLowerCase();
	const rawGuid = first(rawAttribute(entry, 'objectGUID'));
	if (rawGuid === undefined || rawGuid === null || rawGuid === '') return null;
	const guid = guidTextOf(rawGuid);
	if (!guid && !warnedUnreadableGuid) {
		warnedUnreadableGuid = true;
		logger.warn(
			`LDAP: ${entry.dn} has an objectGUID that cannot be read (${Buffer.isBuffer(rawGuid) ? `${rawGuid.length} bytes` : typeof rawGuid}); ` +
				'directory accounts are linked by DN only'
		);
	}
	return guid ? `guid:${guid}` : null;
};

const firstValue = (entry: Entry, attribute: string): string | undefined => {
	const raw = rawAttribute(entry, attribute);
	const value: unknown = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
	return value === undefined ? undefined : asText(value);
};

const allValues = (entry: Entry, attribute: string): string[] => {
	const raw = rawAttribute(entry, attribute);
	if (raw === undefined) return [];
	const values: unknown[] = Array.isArray(raw) ? (raw as unknown[]) : [raw];
	return values.map(asText);
};

// Directory login: find the user with the service account, prove the password by
// binding as them, read their groups, map to a role. One short-lived connection per
// attempt (each bind changes the connection's identity, so it is never shared).
export class LdapAuthenticator {
	private readonly tlsOptions: ConnectionOptions;

	constructor(
		private readonly config: LdapConfig,
		private readonly clientFactory: LdapClientFactory = defaultClientFactory
	) {
		this.tlsOptions = {
			rejectUnauthorized: config.tls?.rejectUnauthorized !== false,
			// Inline PEM (Settings page) or a file path (config.yml / env).
			...(config.tls?.ca
				? { ca: config.tls.ca }
				: config.tls?.ca_file
					? { ca: fs.readFileSync(config.tls.ca_file) }
					: {}),
		};
	}

	// Who the directory says this username or email is — entry, name, groups, role — read
	// with the service account and no proof from the person. For assigning an alert to
	// someone who has never logged in (webhook `owner`): the same rules as a login (one
	// entry, listing that identity, in a mapped group) minus the password. `alternatives`
	// are further spellings tried, one search each, when the first finds no entry. null =
	// not a directory user.
	async lookup(identifier: string, alternatives: string[] = []): Promise<LdapIdentity | null> {
		// The client is made inside the try: a URL the validator let through but the
		// client refuses is "the directory could not be asked", not a verdict.
		let client: LdapClientLike | undefined;
		try {
			client = this.createClient();
			await this.startTlsIfConfigured(client);
			await this.bindServiceAccount(client);
			for (const candidate of [identifier, ...alternatives]) {
				const entry = await this.locate(client, candidate, 'lookup');
				if (!entry) continue;
				const groups = await this.groupsOf(client, entry);
				return this.identityOf(entry, candidate, groups);
			}
			return null;
		} catch (error) {
			if (error instanceof LdapUnavailableError) throw error;
			throw new LdapUnavailableError(`LDAP error: ${(error as Error).message}`);
		} finally {
			await client?.unbind().catch(() => undefined);
		}
	}

	// The one entry for a username or email, or null: not found, ambiguous (two entries
	// share it), or an entry that matched the filter without listing that identity itself
	// (an entry whose self-editable mail attribute names someone else must not stand in
	// for them).
	private async locate(client: LdapClientLike, identifier: string, purpose: string): Promise<Entry | null> {
		const searchEntries = await this.findEntries(client, identifier);
		if (searchEntries.length !== 1) {
			if (searchEntries.length > 1) {
				logger.warn(`LDAP: more than one entry matches ${identifier}; ${purpose} refused`);
			}
			return null;
		}
		const entry = searchEntries[0];
		if (!this.listsIdentifier(entry, identifier)) {
			logger.warn(`LDAP: entry ${entry.dn} matched ${identifier} but does not list it; ${purpose} refused`);
			return null;
		}
		return entry;
	}

	// null = unknown user or wrong password (the caller says "invalid username or
	// password" either way). Throws LdapUnavailableError when the directory can't answer.
	// `alternatives` are further spellings of the same login to try when the first finds
	// no entry (a bare name completed with the default email domain): one search each,
	// and ONE bind, so a wrong password costs the directory's lockout counter one failure.
	async authenticate(
		identifier: string,
		password: string,
		alternatives: string[] = [],
		guard?: LdapBindGuard
	): Promise<LdapIdentity | null> {
		// An LDAP bind with an empty password is an *unauthenticated* bind, which many
		// servers accept as success. Never let one through as a login.
		if (!password) return null;

		let client: LdapClientLike | undefined;
		try {
			client = this.createClient();
			await this.startTlsIfConfigured(client);
			await this.bindServiceAccount(client);
			// Not found, ambiguous, or not listing the typed identity: refuse rather than
			// guess (see locate).
			let found: { entry: Entry; identifier: string } | null = null;
			for (const candidate of [identifier, ...alternatives]) {
				const entry = await this.locate(client, candidate, 'login');
				if (entry) {
					found = { entry, identifier: candidate };
					break;
				}
			}
			if (!found) return null;
			const { entry, identifier: matched } = found;
			// The entry is known now: the failure budget is the account's, whichever name
			// or address reached it.
			if (guard && !guard.allow(entry.dn)) throw new LdapThrottledError(entry.dn);

			try {
				await client.bind(entry.dn, password);
			} catch (error) {
				if (error instanceof InvalidCredentialsError) {
					guard?.failed(entry.dn);
					return null;
				}
				// No verdict. The reservation goes back only when the bind never left:
				// ldapts says so when the socket was not there to send on, or could not be
				// (re)connected. Anything after sending — closed before the answer, timed
				// out — may have been checked and counted by the directory, so it stands.
				const message = error instanceof Error ? error.message : String(error);
				if (bindNeverSent(error)) guard?.abandoned(entry.dn);
				throw new LdapUnavailableError(`LDAP user bind failed: ${message}`);
			}
			guard?.succeeded(entry.dn);

			// Group lookup runs as the service account again: the user may not be allowed
			// to read groups.
			await this.bindServiceAccount(client);
			const groups = await this.groupsOf(client, entry);
			return this.identityOf(entry, matched, groups);
		} catch (error) {
			if (error instanceof LdapUnavailableError || error instanceof LdapThrottledError) throw error;
			throw new LdapUnavailableError(`LDAP error: ${(error as Error).message}`);
		} finally {
			await client?.unbind().catch(() => undefined);
		}
	}

	// Settings page "Test connection": walk the same steps a login takes, stopping at the
	// first failure, and say which one failed and why. With a username or email it also
	// looks that user up and reports the role they would get. No user password is involved.
	async probe(identifier?: string): Promise<LdapTestResult> {
		const started = Date.now();
		const steps: LdapTestStep[] = [];
		let user: LdapTestUser | null = null;
		const pass = (step: LdapTestStep['step'], message: string): void => {
			steps.push({ step, ok: true, message });
		};
		const fail = (step: LdapTestStep['step'], message: string): void => {
			steps.push({ step, ok: false, message });
		};
		let client: LdapClientLike;
		try {
			client = this.createClient();
		} catch (error) {
			fail('connect', (error as Error).message);
			return { ok: false, latencyMs: Date.now() - started, steps, user };
		}
		try {
			try {
				await this.startTlsIfConfigured(client);
			} catch (error) {
				fail('connect', `Could not connect / start TLS: ${(error as Error).message}`);
				return { ok: false, latencyMs: Date.now() - started, steps, user };
			}
			try {
				await (this.config.bind_dn
					? client.bind(this.config.bind_dn, this.config.bind_password)
					: client.search(this.config.search_base as string, {
							scope: 'base',
							filter: '(objectClass=*)',
							attributes: ['dn'],
						}));
				pass('connect', this.config.start_tls ? 'Connected (StartTLS)' : 'Connected');
			} catch (error) {
				// An LDAP result code means the server answered: the connection is fine and
				// the bind itself was refused. Anything else never reached the server.
				if (!(error instanceof ResultCodeError)) {
					fail('connect', `Could not connect: ${(error as Error).message}`);
					return { ok: false, latencyMs: Date.now() - started, steps, user };
				}
				pass('connect', this.config.start_tls ? 'Connected (StartTLS)' : 'Connected');
				fail(
					'service_bind',
					error instanceof InvalidCredentialsError
						? 'The directory refused the service account: check the bind DN and password'
						: `Service account bind failed: ${error.message}`
				);
				return { ok: false, latencyMs: Date.now() - started, steps, user };
			}
			pass(
				'service_bind',
				this.config.bind_dn ? `Signed in as ${this.config.bind_dn}` : 'Anonymous (no bind DN)'
			);

			try {
				await client.search(this.config.search_base as string, {
					scope: 'base',
					filter: '(objectClass=*)',
					attributes: ['dn'],
				});
				pass('search_base', `Found ${this.config.search_base}`);
			} catch (error) {
				fail('search_base', `Cannot read the search base: ${(error as Error).message}`);
				return { ok: false, latencyMs: Date.now() - started, steps, user };
			}

			if (identifier) {
				const entries = await this.findEntries(client, identifier);
				const what = isEmailLike(identifier) ? 'email' : 'username';
				if (entries.length === 0) {
					fail('user_lookup', `No entry matches ${identifier} under the search base`);
				} else if (entries.length > 1) {
					fail('user_lookup', `More than one entry matches ${identifier}: login would be refused`);
				} else if (!this.listsIdentifier(entries[0], identifier)) {
					fail('user_lookup', `${entries[0].dn} matched, but does not list ${identifier} as its ${what}`);
				} else {
					const groups = await this.groupsOf(client, entries[0]);
					const role = resolveLdapRole(groups, this.config.role_mapping, this.config.default_role);
					user = { dn: entries[0].dn, fullName: this.fullNameOf(entries[0], identifier), groups, role };
					if (role) pass('user_lookup', `Found; would sign in as ${role}`);
					// Reachable, but this person could not sign in: that's a failed check.
					else
						fail(
							'user_lookup',
							'Found, but in none of the mapped groups and there is no default role: login would be refused'
						);
				}
			}
			return { ok: steps.every((s) => s.ok), latencyMs: Date.now() - started, steps, user };
		} catch (error) {
			const last = identifier ? 'user_lookup' : 'search_base';
			fail(last, (error as Error).message);
			return { ok: false, latencyMs: Date.now() - started, steps, user };
		} finally {
			await client.unbind().catch(() => undefined);
		}
	}

	// One short-lived client. See authenticate() for why nothing is shared.
	private createClient(): LdapClientLike {
		const timeout = this.config.timeout_ms ?? DEFAULT_LDAP_TIMEOUT_MS;
		const url = this.config.url as string;
		let plainSockets = 0;
		return this.clientFactory({
			url,
			timeout,
			connectTimeout: timeout,
			// ldapts opens a TLS socket whenever tlsOptions is set, whatever the URL says:
			// on ldap:// that breaks plain and StartTLS connections. StartTLS gets the
			// options through startTLS() below instead. A fresh copy each time: ldapts
			// writes the socket into the object it is given.
			...(url.toLowerCase().startsWith('ldaps://') ? { tlsOptions: { ...this.tlsOptions } } : {}),
			// ldapts silently reconnects when the connection drops. After StartTLS that
			// reconnect would be plain TCP and the next bind would send a password in
			// clear, so with StartTLS only the first socket is ever opened.
			...(this.config.start_tls
				? {
						// ldapts types createConnection as net.connect and then calls it with
						// (port, host), so the guard below takes every shape net.connect accepts.
						createConnection: (
							target: string | number | net.NetConnectOpts,
							host?: string | (() => void)
						): net.Socket => {
							plainSockets++;
							if (plainSockets === 1) {
								if (typeof target === 'number') {
									return net.connect(target, typeof host === 'string' ? host : undefined);
								}
								if (typeof target === 'string') return net.connect(target);
								return net.connect(target);
							}
							const refused = new net.Socket();
							process.nextTick(() => refused.destroy(new Error(STARTTLS_RECONNECT_REFUSED)));
							return refused;
						},
					}
				: {}),
		});
	}

	private async startTlsIfConfigured(client: LdapClientLike): Promise<void> {
		if (!this.config.start_tls) return;
		const host = new URL(this.config.url as string).hostname;
		// Without servername/host, Node checks the certificate against "localhost".
		await client.startTLS({
			...this.tlsOptions,
			host,
			// SNI takes DNS names only; for an IP the certificate is still checked against `host`.
			...(net.isIP(host) ? {} : { servername: host }),
		});
	}

	// Configured names are trimmed: " uid " is the attribute uid (the validator checks it so).
	private usernameAttribute(): string {
		return attributeName(this.config.username_attribute, DEFAULT_USERNAME_ATTRIBUTE);
	}

	private emailAttribute(): string {
		return attributeName(this.config.email_attribute, DEFAULT_EMAIL_ATTRIBUTE);
	}

	// Without a configured filter: the typed value is matched against the username
	// attribute or the email attribute, whichever it is.
	private searchFilter(): string {
		return this.config.search_filter ?? defaultSearchFilter(this.config);
	}

	private async findEntries(client: LdapClientLike, identifier: string): Promise<Entry[]> {
		const nameAttr = this.config.name_attribute ?? 'displayName';
		const groupsAttr = this.config.groups_attribute ?? 'memberOf';
		// Function replacers: a string replacement would expand $&, $' and $` in the value.
		const escaped = escapeFilterValue(identifier.trim());
		// One pass over both placeholders: a value that itself contains "{{email}}" must
		// not be substituted a second time.
		const filter = this.searchFilter().replace(/\{\{(login|email)\}\}/g, () => escaped);
		const { searchEntries } = await this.search(client, this.config.search_base as string, {
			scope: 'sub',
			filter,
			attributes: [
				this.usernameAttribute(),
				this.emailAttribute(),
				nameAttr,
				'cn',
				groupsAttr,
				...OBJECT_ID_ATTRIBUTES,
			],
			// Active Directory's objectGUID is 16 raw bytes: decoded as text it is not unique.
			// ldapts matches these to the response's spelling exactly, hence the variants.
			explicitBufferAttributes: OBJECT_GUID_SPELLINGS,
			sizeLimit: 2,
		});
		return searchEntries;
	}

	// The entry itself names the typed identity: the typed email among its email values,
	// or the typed username among its username values (letter case aside).
	private listsIdentifier(entry: Entry, identifier: string): boolean {
		const typed = identifier.trim().toLowerCase();
		const attribute = isEmailLike(typed) ? this.emailAttribute() : this.usernameAttribute();
		return allValues(entry, attribute).some((value) => value.trim().toLowerCase() === typed);
	}

	// The identity an entry yields: the entry's own username (its first username
	// attribute value) and its own first address, whichever side was typed — so one
	// entry always maps to one account and signing in by an alias never rewrites the
	// stored contact. The typed value was already checked against the entry's values by
	// listsIdentifier; it is only the fallback for an entry that lists no address or no
	// username of its own.
	private identityOf(entry: Entry, identifier: string, groups: string[]): LdapIdentity {
		const typed = identifier.trim().toLowerCase();
		const directoryUsername = firstValue(entry, this.usernameAttribute())?.trim();
		const directoryEmail = firstValue(entry, this.emailAttribute())?.trim().toLowerCase() || null;
		const email = directoryEmail ?? (isEmailLike(typed) ? typed : null);
		// Without a username attribute the name comes from the entry's own address — the
		// same one every time — and only an entry listing no address at all falls back to
		// what was typed.
		const username = foldUsername(directoryUsername || (email ? usernameFromEmail(email) : typed));
		return {
			dn: entry.dn,
			objectId: objectIdOf(entry),
			username,
			email,
			fullName: this.fullNameOf(entry, identifier),
			groups,
			role: resolveLdapRole(groups, this.config.role_mapping, this.config.default_role),
		};
	}

	// Runs as whoever the connection is bound as: the service account.
	private async groupsOf(client: LdapClientLike, entry: Entry): Promise<string[]> {
		const groups = [...allValues(entry, this.config.groups_attribute ?? 'memberOf')];
		if (this.config.group_search_base) {
			const escapedDn = escapeFilterValue(entry.dn);
			const groupFilter = (this.config.group_search_filter ?? '(member={{dn}})').replaceAll(
				'{{dn}}',
				() => escapedDn
			);
			const found = await this.search(client, this.config.group_search_base, {
				scope: 'sub',
				filter: groupFilter,
				attributes: ['cn'],
			});
			groups.push(...found.searchEntries.map((g) => g.dn));
		}
		return groups;
	}

	private fullNameOf(entry: Entry, fallback: string): string {
		return firstValue(entry, this.config.name_attribute ?? 'displayName') ?? firstValue(entry, 'cn') ?? fallback;
	}

	private async bindServiceAccount(client: LdapClientLike): Promise<void> {
		if (!this.config.bind_dn) return;
		try {
			await client.bind(this.config.bind_dn, this.config.bind_password);
		} catch (error) {
			// A wrong service-account password is a configuration problem, not the user's.
			throw new LdapUnavailableError(`LDAP service account bind failed: ${(error as Error).message}`);
		}
	}

	private async search(client: LdapClientLike, base: string, options: LdapSearchOptions): Promise<LdapSearchResult> {
		try {
			return await client.search(base, options);
		} catch (error) {
			throw new LdapUnavailableError(`LDAP search failed: ${(error as Error).message}`);
		}
	}
}
