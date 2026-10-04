import { ClientOptions, InvalidCredentialsError } from 'ldapts';
import { Role } from '@OpsiMate/shared';
import { Socket } from 'node:net';
import { afterEach, describe, expect, test, vi } from 'vitest';
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
	// The search matches this address although the entry's mail says otherwise
	// (a custom filter on another attribute, or a self-edited extra value).
	searchAs?: string;
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
			const users = this.dir.users.filter(
				(u) => escapeFilterValue(u.searchAs ?? u.mail).toLowerCase() === mailMatch[1].toLowerCase()
			);
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

describe('LdapAuthenticator hardening', () => {
	test('StartTLS checks the certificate against the LDAP host, not "localhost"', async () => {
		const startTLS = vi.fn().mockResolvedValue(undefined);
		const auth = new LdapAuthenticator({ ...CONFIG, url: 'ldap://dir.corp.example:389', start_tls: true }, () => {
			const c = new FakeClient(DIR);
			c.startTLS = startTLS;
			return c;
		});
		await auth.authenticate('alice@example.com', 'alice-pw');
		expect(startTLS).toHaveBeenCalledWith(
			expect.objectContaining({ servername: 'dir.corp.example', host: 'dir.corp.example' })
		);
	});

	test('with StartTLS, a dropped connection is never reopened in clear', async () => {
		const { auth, options } = make({ ...CONFIG, url: 'ldap://127.0.0.1:9', start_tls: true });
		await auth.authenticate('alice@example.com', 'alice-pw');
		const connect = options[0].createConnection as (port: number, host: string) => Socket;
		const first = connect(9, '127.0.0.1');
		first.on('error', () => undefined);
		first.destroy();
		const second = connect(9, '127.0.0.1');
		const error = await new Promise<Error>((resolve) => second.once('error', resolve));
		expect(error.message).toMatch(/not reconnecting in clear/);
		// Without StartTLS there is no such guard (an ldaps:// reconnect is TLS again).
		expect(make().options.length).toBe(0);
		const plain = make();
		await plain.auth.authenticate('alice@example.com', 'alice-pw');
		expect(plain.options[0].createConnection).toBeUndefined();
	});

	test('an entry that does not list the typed email itself is refused', async () => {
		const dir: FakeDirectory = {
			...DIR,
			users: [
				...DIR.users,
				{
					dn: 'uid=mallory,ou=people,dc=example,dc=com',
					mail: 'mallory@example.com',
					searchAs: 'victim@example.com',
					password: 'mallory-pw',
					memberOf: ['cn=ops-admins,ou=groups,dc=example,dc=com'],
				},
			],
		};
		const { auth } = make(CONFIG, dir);
		expect(await auth.authenticate('victim@example.com', 'mallory-pw')).toBeNull();
		// The identity's email is the typed one (lower-cased), never another directory value.
		expect((await auth.authenticate('ALICE@example.com', 'alice-pw'))?.email).toBe('alice@example.com');
	});

	test('$ patterns in a DN are not expanded into the group filter', async () => {
		const dn = "uid=x$'y$&,ou=people,dc=example,dc=com";
		const dir: FakeDirectory = {
			...DIR,
			users: [{ dn, mail: 'x@example.com', password: 'x-pw', memberOf: [] }],
			groups: [{ dn: 'cn=sre,ou=groups,dc=example,dc=com', member: [dn] }],
		};
		const { auth, clients } = make({ ...CONFIG, group_search_base: 'ou=groups,dc=example,dc=com' }, dir);
		expect((await auth.authenticate('x@example.com', 'x-pw'))?.role).toBe(Role.Editor);
		expect(clients[0].calls).toContain(`search ou=groups,dc=example,dc=com (member=${dn})`);
	});
});

describe('LdapAuthenticator.probe (Settings page test)', () => {
	test('all steps pass and the user lookup reports the role they would get', async () => {
		const { auth } = make();
		const result = await auth.probe('alice@example.com');
		expect(result.ok).toBe(true);
		expect(result.steps.map((s) => s.step)).toEqual(['connect', 'service_bind', 'search_base', 'user_lookup']);
		expect(result.user).toMatchObject({ dn: 'uid=alice,ou=people,dc=example,dc=com', role: Role.Admin });
	});

	test('a user in no mapped group fails the lookup step: they could not sign in', async () => {
		const { auth } = make({ ...CONFIG, role_mapping: { admin: ['nobody'] } });
		const result = await auth.probe('bob@example.com');
		expect(result.ok).toBe(false);
		expect(result.steps.at(-1)).toMatchObject({ step: 'user_lookup', ok: false });
		expect(result.user?.role).toBeNull();
	});

	test('a wrong service password fails at service_bind, not connect', async () => {
		const result = await make({ ...CONFIG, bind_password: 'wrong' }).auth.probe();
		expect(result.steps).toEqual([
			expect.objectContaining({ step: 'connect', ok: true }),
			expect.objectContaining({ step: 'service_bind', ok: false }),
		]);
	});

	test('an unreachable server fails at connect', async () => {
		const result = await make(CONFIG, { ...DIR, down: true }).auth.probe();
		expect(result.steps).toEqual([expect.objectContaining({ step: 'connect', ok: false })]);
	});

	test('an unknown email is reported, without guessing', async () => {
		const result = await make().auth.probe('ghost@example.com');
		expect(result.ok).toBe(false);
		expect(result.steps.at(-1)?.message).toMatch(/No entry matches/);
		expect(result.user).toBeNull();
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

	test('bad values switch it off instead of misbehaving at login', () => {
		const base = { enabled: true, url: 'ldaps://dir', search_base: 'dc=x', default_role: 'viewer' as const };
		expect(resolveLdapConfig({ ...base, timeout_ms: Number('abc') }).enabled).toBe(false);
		expect(resolveLdapConfig({ ...base, tls: { ca_file: '/nonexistent/ca.pem' } }).enabled).toBe(false);
		expect(resolveLdapConfig({ ...base, start_tls: true }).enabled).toBe(false); // ldaps + StartTLS
		expect(resolveLdapConfig({ ...base, enabled: 'false' as unknown as boolean }).enabled).toBe(false);
	});

	test('login_max_failures: from LDAP_LOGIN_MAX_FAILURES, a whole number ≥ 0', () => {
		const base = { enabled: true, url: 'ldaps://dir', search_base: 'dc=x', default_role: 'viewer' as const };
		process.env.LDAP_LOGIN_MAX_FAILURES = '10';
		expect(resolveLdapConfig(base)).toMatchObject({ enabled: true, login_max_failures: 10 });
		process.env.LDAP_LOGIN_MAX_FAILURES = '0';
		expect(resolveLdapConfig(base)).toMatchObject({ enabled: true, login_max_failures: 0 });
		for (const bad of ['-1', '2.5', 'abc']) {
			process.env.LDAP_LOGIN_MAX_FAILURES = bad;
			expect(resolveLdapConfig(base).enabled).toBe(false);
		}
	});

	test('an empty or unrelated LDAP_* variable does not make LDAP server-managed', async () => {
		const savedConfigFile = process.env.CONFIG_FILE;
		delete process.env.CONFIG_FILE;
		try {
			process.env.LDAP_URL = '';
			process.env.LDAP_SOMETHING_UNRELATED = 'x';
			vi.resetModules();
			expect((await import('../src/config/config')).isLdapManagedByConfig()).toBe(false);
			process.env.LDAP_URL = 'ldaps://dir.example.com';
			vi.resetModules();
			expect((await import('../src/config/config')).isLdapManagedByConfig()).toBe(true);
		} finally {
			delete process.env.LDAP_SOMETHING_UNRELATED;
			if (savedConfigFile !== undefined) process.env.CONFIG_FILE = savedConfigFile;
			vi.resetModules();
		}
	});

	test('a single group written as a string counts as a one-item list', () => {
		const c = resolveLdapConfig({
			enabled: true,
			url: 'ldaps://dir',
			search_base: 'dc=x',
			role_mapping: { admin: 'cn=ops,dc=x' as unknown as string[] },
		});
		expect(c.enabled).toBe(true);
		expect(c.role_mapping?.admin).toEqual(['cn=ops,dc=x']);
	});
});
