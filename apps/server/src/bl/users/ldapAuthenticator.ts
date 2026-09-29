import fs from 'node:fs';
import net from 'node:net';
import type { ConnectionOptions } from 'node:tls';
import { Client, ClientOptions, Entry, InvalidCredentialsError } from 'ldapts';
import { Logger, Role } from '@OpsiMate/shared';
import { LdapConfig, LdapRoleMapping } from '../../config/config';

const logger = new Logger('bl/users/ldap');

// Who the directory says the person is, after their password checked out.
export interface LdapIdentity {
	dn: string;
	email: string;
	fullName: string;
	// Group DNs (or names) the user belongs to.
	groups: string[];
	// The OpsiMate role their groups map to; null = in no mapped group and no default.
	role: Role | null;
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
}

export interface LdapSearchResult {
	searchEntries: Entry[];
}

export type LdapClientFactory = (options: ClientOptions) => LdapClientLike;

const defaultClientFactory: LdapClientFactory = (options) => new Client(options);

// RFC 4515 escaping for a value placed inside a search filter: without it an email
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

const firstValue = (entry: Entry, attribute: string): string | undefined => {
	const raw = entry[attribute] ?? entry[attribute.toLowerCase()];
	const value = Array.isArray(raw) ? raw[0] : raw;
	if (value === undefined) return undefined;
	return Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
};

const allValues = (entry: Entry, attribute: string): string[] => {
	const raw = entry[attribute] ?? entry[attribute.toLowerCase()];
	if (raw === undefined) return [];
	return (Array.isArray(raw) ? raw : [raw]).map((v) => (Buffer.isBuffer(v) ? v.toString('utf8') : String(v)));
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
			...(config.tls?.ca_file ? { ca: fs.readFileSync(config.tls.ca_file) } : {}),
		};
	}

	// null = unknown user or wrong password (the caller says "invalid email or
	// password" either way). Throws LdapUnavailableError when the directory can't answer.
	async authenticate(email: string, password: string): Promise<LdapIdentity | null> {
		// An LDAP bind with an empty password is an *unauthenticated* bind, which many
		// servers accept as success. Never let one through as a login.
		if (!password) return null;

		const timeout = this.config.timeout_ms ?? 5000;
		const url = this.config.url as string;
		const host = new URL(url).hostname;
		let plainSockets = 0;
		const client = this.clientFactory({
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
						createConnection: (port: number, connectHost: string): net.Socket => {
							plainSockets++;
							if (plainSockets === 1) return net.connect(port, connectHost);
							const refused = new net.Socket();
							process.nextTick(() =>
								refused.destroy(
									new Error('LDAP connection dropped after StartTLS; not reconnecting in clear')
								)
							);
							return refused;
						},
					}
				: {}),
		});
		try {
			// Without servername/host, Node checks the certificate against "localhost".
			if (this.config.start_tls)
				await client.startTLS({
					...this.tlsOptions,
					host,
					// SNI takes DNS names only; for an IP the certificate is still checked against `host`.
					...(net.isIP(host) ? {} : { servername: host }),
				});
			await this.bindServiceAccount(client);

			const emailAttr = this.config.email_attribute ?? 'mail';
			const nameAttr = this.config.name_attribute ?? 'displayName';
			const groupsAttr = this.config.groups_attribute ?? 'memberOf';
			// Function replacers: a string replacement would expand $&, $' and $` in the value.
			const escapedEmail = escapeFilterValue(email);
			const filter = (this.config.search_filter ?? '(mail={{email}})').replaceAll(
				'{{email}}',
				() => escapedEmail
			);
			const { searchEntries } = await this.search(client, this.config.search_base as string, {
				scope: 'sub',
				filter,
				attributes: [emailAttr, nameAttr, 'cn', groupsAttr],
				sizeLimit: 2,
			});
			// Not found, or ambiguous (two entries share the email): refuse rather than guess.
			if (searchEntries.length !== 1) {
				if (searchEntries.length > 1) logger.warn(`LDAP: more than one entry matches ${email}; login refused`);
				return null;
			}
			const entry = searchEntries[0];
			// The account is keyed on the email that was typed, and the entry must list that
			// exact address itself: otherwise an entry whose (self-editable) mail attribute
			// names someone else, or a custom filter matching some other attribute, could
			// sign in to that other person's OpsiMate account.
			const typedEmail = email.trim().toLowerCase();
			if (!allValues(entry, emailAttr).some((value) => value.trim().toLowerCase() === typedEmail)) {
				logger.warn(
					`LDAP: entry ${entry.dn} matched ${email} but does not list it in ${emailAttr}; login refused`
				);
				return null;
			}

			try {
				await client.bind(entry.dn, password);
			} catch (error) {
				if (error instanceof InvalidCredentialsError) return null;
				throw new LdapUnavailableError(`LDAP user bind failed: ${(error as Error).message}`);
			}

			// Group lookup runs as the service account again: the user may not be allowed
			// to read groups.
			await this.bindServiceAccount(client);
			const groups = [...allValues(entry, groupsAttr)];
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

			return {
				dn: entry.dn,
				email: typedEmail,
				fullName: firstValue(entry, nameAttr) ?? firstValue(entry, 'cn') ?? email,
				groups,
				role: resolveLdapRole(groups, this.config.role_mapping, this.config.default_role),
			};
		} catch (error) {
			if (error instanceof LdapUnavailableError) throw error;
			throw new LdapUnavailableError(`LDAP error: ${(error as Error).message}`);
		} finally {
			await client.unbind().catch(() => undefined);
		}
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
