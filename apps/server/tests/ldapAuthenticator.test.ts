import { ClientOptions, InvalidCredentialsError } from 'ldapts';
import { Role } from '@OpsiMate/shared';
import { afterEach, describe, expect, test } from 'vitest';
import {
	escapeFilterValue,
	LdapAuthenticator,
	LdapClientLike,
	LdapSearchOptions,
	LdapSearchResult,
	LdapUnavailableError,
	resolveLdapRole,
} from '../src/bl/users/ldapAuthenticator';
import { LdapConfig, resolveLdapConfig } from '../src/config/config';

// A scripted LDAP client: records every call, answers from a small directory.
interface FakeUser {
	dn: string;
	mail: string;
	displayName?: string;
	cn?: string;
	password: string;
	memberOf?: string[];
}

interface FakeGroup {
	dn: string;
	member: string[];
}

interface FakeDirectory {
	serviceDn: string;
	servicePassword: string;
	users: FakeUser[];
	groups: FakeGroup[];
	down?: boolean;
}

class FakeClient implements LdapClientLike {
	calls: string[] = [];
	constructor(private readonly dir: FakeDirectory) {}
	startTLS(): Promise<void> {
		this.calls.push('startTLS');
		return Promise.resolve();
	}
	bind(dn: string, password?: string): Promise<void> {
		this.calls.push(`bind ${dn}`);
		if (this.dir.down) return Promise.reject(new Error('connect ECONNREFUSED'));
		if (dn === this.dir.serviceDn && password === this.dir.servicePassword) return Promise.resolve();
		const user = this.dir.users.find((u) => u.dn === dn);
		if (user && user.password === password) return Promise.resolve();
		return Promise.reject(new InvalidCredentialsError('Invalid Credentials'));
	}
	search(base: string, options: LdapSearchOptions): Promise<LdapSearchResult> {
		this.calls.push(`search ${base} ${options.filter}`);
		const mailMatch = /^\(mail=(.*)\)$/.exec(options.filter);
		if (mailMatch) {
			const users = this.dir.users.filter((u) => escapeFilterValue(u.mail) === mailMatch[1]);
			return Promise.resolve({
				searchEntries: users.map((u) => ({
					dn: u.dn,
					mail: u.mail,
					...(u.displayName ? { displayName: u.displayName } : {}),
					cn: u.cn ?? u.mail,
					memberOf: u.memberOf ?? [],
				})),
			});
		}
		const memberMatch = /^\(member=(.*)\)$/.exec(options.filter);
		if (memberMatch) {
			const groups = this.dir.groups.filter((g) => g.member.some((m) => escapeFilterValue(m) === memberMatch[1]));
			return Promise.resolve({ searchEntries: groups.map((g) => ({ dn: g.dn })) });
		}
		return Promise.resolve({ searchEntries: [] });
	}
	unbind(): Promise<void> {
		this.calls.push('unbind');
		return Promise.resolve();
	}
}

const DIR: FakeDirectory = {
	serviceDn: 'cn=svc,dc=example,dc=com',
	servicePassword: 'svc-secret',
	users: [
		{
			dn: 'uid=alice,ou=people,dc=example,dc=com',
			mail: 'alice@example.com',
			displayName: 'Alice Admin',
			password: 'alice-pw',
			memberOf: ['cn=ops-admins,ou=groups,dc=example,dc=com'],
		},
		{
			dn: 'uid=bob,ou=people,dc=example,dc=com',
			mail: 'bob@example.com',
			cn: 'Bob',
			password: 'bob pw with spaces',
			memberOf: [],
		},
	],
	groups: [{ dn: 'cn=sre,ou=groups,dc=example,dc=com', member: ['uid=bob,ou=people,dc=example,dc=com'] }],
};

const CONFIG: LdapConfig = {
	enabled: true,
	url: 'ldaps://ldap.example.com',
	bind_dn: DIR.serviceDn,
	bind_password: DIR.servicePassword,
	search_base: 'ou=people,dc=example,dc=com',
	role_mapping: { admin: ['cn=ops-admins,ou=groups,dc=example,dc=com'], editor: ['sre'] },
};

const make = (config: LdapConfig = CONFIG, dir: FakeDirectory = DIR) => {
	const clients: FakeClient[] = [];
	const options: ClientOptions[] = [];
	const auth = new LdapAuthenticator(config, (o) => {
		options.push(o);
		const c = new FakeClient(dir);
		clients.push(c);
		return c;
	});
	return { auth, clients, options };
};

describe('escapeFilterValue (RFC 4515)', () => {
	test('escapes the characters that would change a filter', () => {
		expect(escapeFilterValue('*)(uid=*')).toBe('\\2a\\29\\28uid=\\2a');
		expect(escapeFilterValue('a\\b')).toBe('a\\5cb');
		expect(escapeFilterValue('nul\0x')).toBe('nul\\00x');
		expect(escapeFilterValue('plain@example.com')).toBe('plain@example.com');
	});
});

describe('resolveLdapRole', () => {
	const mapping = { admin: ['cn=Ops-Admins,ou=groups,dc=x'], editor: ['sre'], viewer: ['everyone'] };
	test('full DN, case-insensitive', () => {
		expect(resolveLdapRole(['CN=ops-admins,OU=groups,DC=x'], mapping, undefined)).toBe(Role.Admin);
	});
	test('bare name matches the group leaf name', () => {
		expect(resolveLdapRole(['cn=SRE,ou=groups,dc=x'], mapping, undefined)).toBe(Role.Editor);
	});
	test('highest role wins', () => {
		expect(resolveLdapRole(['cn=everyone,dc=x', 'cn=ops-admins,ou=groups,dc=x'], mapping, undefined)).toBe(
			Role.Admin
		);
	});
	test('no match: the default role, or null (refused)', () => {
		expect(resolveLdapRole(['cn=other,dc=x'], mapping, 'viewer')).toBe(Role.Viewer);
		expect(resolveLdapRole(['cn=other,dc=x'], mapping, undefined)).toBeNull();
		expect(resolveLdapRole([], undefined, undefined)).toBeNull();
	});
});

describe('LdapAuthenticator', () => {
	test('valid credentials: identity with name, email and the mapped role; connection closed', async () => {
		const { auth, clients } = make();
		const id = await auth.authenticate('alice@example.com', 'alice-pw');
		expect(id).toMatchObject({ email: 'alice@example.com', fullName: 'Alice Admin', role: Role.Admin });
		expect(clients[0].calls.at(-1)).toBe('unbind');
	});

	test('wrong password → null; unknown user → null', async () => {
		const { auth } = make();
		expect(await auth.authenticate('alice@example.com', 'nope')).toBeNull();
		expect(await auth.authenticate('nobody@example.com', 'x')).toBeNull();
	});

	test('an empty password is refused before any bind (no anonymous-bind login)', async () => {
		const { auth, clients } = make();
		expect(await auth.authenticate('alice@example.com', '')).toBeNull();
		expect(clients).toHaveLength(0);
	});

	test('passwords with spaces work; name falls back to cn; groups found by group search', async () => {
		const { auth } = make({ ...CONFIG, group_search_base: 'ou=groups,dc=example,dc=com' });
		const id = await auth.authenticate('bob@example.com', 'bob pw with spaces');
		expect(id).toMatchObject({ fullName: 'Bob', role: Role.Editor });
		expect(id?.groups).toContain('cn=sre,ou=groups,dc=example,dc=com');
	});

	test('an injection attempt in the email is escaped in the filter', async () => {
		const { auth, clients } = make();
		expect(await auth.authenticate('*)(mail=*', 'x')).toBeNull();
		expect(clients[0].calls.find((c) => c.startsWith('search'))).toContain('(mail=\\2a\\29\\28mail=\\2a)');
	});

	test('two entries for one email → refused (never guess)', async () => {
		const dup: FakeDirectory = {
			...DIR,
			users: [...DIR.users, { ...DIR.users[0], dn: 'uid=alice2,ou=people,dc=example,dc=com' }],
		};
		const { auth } = make(CONFIG, dup);
		expect(await auth.authenticate('alice@example.com', 'alice-pw')).toBeNull();
	});

	test('directory down or wrong service password → LdapUnavailableError (not "wrong password")', async () => {
		await expect(
			make(CONFIG, { ...DIR, down: true }).auth.authenticate('alice@example.com', 'alice-pw')
		).rejects.toBeInstanceOf(LdapUnavailableError);
		await expect(
			make({ ...CONFIG, bind_password: 'wrong' }).auth.authenticate('alice@example.com', 'alice-pw')
		).rejects.toBeInstanceOf(LdapUnavailableError);
	});

	test('TLS options reach the client only for ldaps:// (ldapts would otherwise open TLS on ldap://)', async () => {
		const plain = make({ ...CONFIG, url: 'ldap://ldap.example.com' });
		await plain.auth.authenticate('alice@example.com', 'alice-pw');
		expect(plain.options[0].tlsOptions).toBeUndefined();
		const secure = make();
		await secure.auth.authenticate('alice@example.com', 'alice-pw');
		expect(secure.options[0].tlsOptions).toMatchObject({ rejectUnauthorized: true });
	});

	test('start_tls upgrades the connection before any bind', async () => {
		const { auth, clients } = make({ ...CONFIG, url: 'ldap://ldap.example.com', start_tls: true });
		await auth.authenticate('alice@example.com', 'alice-pw');
		expect(clients[0].calls[0]).toBe('startTLS');
	});
});

describe('resolveLdapConfig', () => {
	const saved = { ...process.env };
	afterEach(() => {
		for (const key of Object.keys(process.env)) if (key.startsWith('LDAP_')) delete process.env[key];
		Object.assign(process.env, saved);
	});

	test('LDAP_* environment variables configure it; group lists split on ; or |', () => {
		Object.assign(process.env, {
			LDAP_ENABLED: 'true',
			LDAP_URL: 'ldaps://dir:636',
			LDAP_SEARCH_BASE: 'dc=x',
			LDAP_ROLE_ADMIN_GROUPS: 'cn=a,dc=x;cn=b,dc=x',
			LDAP_ROLE_VIEWER_GROUPS: 'everyone',
		});
		const c = resolveLdapConfig(undefined);
		expect(c.enabled).toBe(true);
		expect(c.role_mapping?.admin).toEqual(['cn=a,dc=x', 'cn=b,dc=x']);
		expect(c.role_mapping?.viewer).toEqual(['everyone']);
	});

	test('enabled but incomplete → switched off, not a crash', () => {
		expect(resolveLdapConfig({ enabled: true, url: 'ldaps://dir' }).enabled).toBe(false); // no search_base
		expect(
			resolveLdapConfig({ enabled: true, url: 'http://dir', search_base: 'dc=x', default_role: 'viewer' }).enabled
		).toBe(false);
		// Nobody could log in: no mapping and no default role.
		expect(resolveLdapConfig({ enabled: true, url: 'ldaps://dir', search_base: 'dc=x' }).enabled).toBe(false);
		expect(
			resolveLdapConfig({ enabled: true, url: 'ldaps://dir', search_base: 'dc=x', default_role: 'viewer' })
				.enabled
		).toBe(true);
	});
});
