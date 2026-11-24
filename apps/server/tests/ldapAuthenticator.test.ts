import { BusyError, ClientOptions, InvalidCredentialsError } from 'ldapts';
import { Role } from '@OpsiMate/shared';
import { Socket } from 'node:net';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	escapeFilterValue,
	LdapAuthenticator,
	LdapBindGuard,
	LdapClientLike,
	LdapSearchOptions,
	LdapSearchResult,
	LdapThrottledError,
	LdapUnavailableError,
	resolveLdapRole,
} from '../src/bl/users/ldapAuthenticator';
import { LdapConfig, resolveLdapConfig } from '../src/config/config';

// A scripted LDAP client: records every call, answers from a small directory.
interface FakeUser {
	dn: string;
	// The login name (uid); defaults to the first component of the DN.
	uid?: string;
	// Absent for an entry with no address.
	mail?: string;
	// Further addresses the entry lists (aliases); mail stays the first.
	mails?: string[];
	displayName?: string;
	cn?: string;
	password: string;
	memberOf?: string[];
	// The search matches this address although the entry's mail says otherwise
	// (a custom filter on another attribute, or a self-edited extra value).
	searchAs?: string;
	// The operational id the directory returns; null = none (an older server), default uuid-<uid>.
	entryUUID?: string | null;
	// Active Directory's id: 16 raw bytes, or (through a proxy) text.
	objectGUID?: Buffer | string;
	// The user bind fails with this error (a message, or an Error) instead of a verdict.
	bindError?: string | Error;
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
		if (user?.bindError) {
			return Promise.reject(typeof user.bindError === 'string' ? new Error(user.bindError) : user.bindError);
		}
		if (user && user.password === password) return Promise.resolve();
		return Promise.reject(new InvalidCredentialsError('Invalid Credentials'));
	}
	searches: LdapSearchOptions[] = [];
	search(base: string, options: LdapSearchOptions): Promise<LdapSearchResult> {
		this.calls.push(`search ${base} ${options.filter}`);
		this.searches.push(options);
		// A user filter: one or more (attr=value) terms, possibly OR-ed: (mail=x), (uid=x),
		// (|(uid=x)(mail=x)). A user matches when any term names it.
		const terms = [...options.filter.matchAll(/\((uid|mail)=([^()]*)\)/gi)].map((m) => ({
			attribute: m[1].toLowerCase(),
			value: m[2].toLowerCase(),
		}));
		if (terms.length > 0 && !options.filter.startsWith('(member=')) {
			const uidOf = (u: FakeUser) => u.uid ?? u.dn.split(',')[0].split('=')[1];
			const addressesOf = (u: FakeUser) =>
				[u.searchAs, u.mail, ...(u.mails ?? [])].filter((a): a is string => a !== undefined);
			const users = this.dir.users.filter((u) =>
				terms.some(({ attribute, value }) =>
					attribute === 'mail'
						? addressesOf(u).some((a) => escapeFilterValue(a).toLowerCase() === value)
						: escapeFilterValue(uidOf(u)).toLowerCase() === value
				)
			);
			return Promise.resolve({
				searchEntries: users.map((u) => ({
					dn: u.dn,
					uid: uidOf(u),
					...(u.entryUUID === null ? {} : { entryUUID: u.entryUUID ?? `uuid-${uidOf(u)}` }),
					...(u.objectGUID !== undefined ? { objectGUID: u.objectGUID } : {}),
					...(u.mail ? { mail: u.mails ? [u.mail, ...u.mails] : u.mail } : {}),
					...(u.displayName ? { displayName: u.displayName } : {}),
					cn: u.cn ?? u.mail ?? uidOf(u),
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
	test('valid credentials: identity with username, name, email and the mapped role; connection closed', async () => {
		const { auth, clients } = make();
		const id = await auth.authenticate('alice@example.com', 'alice-pw');
		expect(id).toMatchObject({
			username: 'alice',
			email: 'alice@example.com',
			fullName: 'Alice Admin',
			role: Role.Admin,
		});
		expect(clients[0].calls.at(-1)).toBe('unbind');
	});

	test('a username signs in too: matched on uid, the email read from the entry', async () => {
		const { auth, clients } = make();
		const id = await auth.authenticate('Alice', 'alice-pw');
		expect(id).toMatchObject({ username: 'alice', email: 'alice@example.com', role: Role.Admin });
		expect(clients[0].calls.find((c) => c.startsWith('search'))).toContain('(|(uid=Alice)(mail=Alice))');
	});

	test("the username is the entry's own uid whichever side was typed, so one entry is one account", async () => {
		const dir: FakeDirectory = {
			...DIR,
			users: [
				{ ...DIR.users[0], uid: 'alice', mail: 'alice.admin@example.com', searchAs: 'alice.admin@example.com' },
			],
		};
		const { auth } = make(CONFIG, dir);
		expect((await auth.authenticate('alice.admin@example.com', 'alice-pw'))?.username).toBe('alice');
		expect((await auth.authenticate('ALICE', 'alice-pw'))?.username).toBe('alice');
	});

	test("signing in by an alias keeps the entry's first address as the stored email", async () => {
		const dir: FakeDirectory = {
			...DIR,
			users: [{ ...DIR.users[0], mails: ['hubert@example.com'] }],
		};
		const { auth } = make(CONFIG, dir);
		const byAlias = await auth.authenticate('hubert@example.com', 'alice-pw');
		expect(byAlias).toMatchObject({ username: 'alice', email: 'alice@example.com' });
		expect((await auth.authenticate('alice', 'alice-pw'))?.email).toBe('alice@example.com');
	});

	test("without a username attribute the name comes from the entry's own address, whichever alias signed in", async () => {
		const dir: FakeDirectory = {
			...DIR,
			users: [{ ...DIR.users[0], mails: ['alice.ops@example.com'] }],
		};
		const { auth } = make({ ...CONFIG, username_attribute: 'nonesuch' }, dir);
		expect((await auth.authenticate('alice.ops@example.com', 'alice-pw'))?.username).toBe('alice');
		expect((await auth.authenticate('alice@example.com', 'alice-pw'))?.username).toBe('alice');
	});

	test('the object id is the entryUUID when the directory returns one', async () => {
		const { auth } = make();
		expect((await auth.authenticate('alice', 'alice-pw'))?.objectId).toBe('uuid-alice');
	});

	test("Active Directory's objectGUID is asked for as bytes; bytes and text, however delivered, give one id", async () => {
		const guid = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
		// The first three fields are little-endian in the bytes: 01 23 45 67 reads 67452301.
		const key = 'guid:67452301-ab89-efcd-0123-456789abcdef';
		const ad = (objectGUID: Buffer | string): FakeDirectory => ({
			...DIR,
			users: [{ dn: 'cn=ann,ou=people,dc=example,dc=com', password: 'ann-pw', entryUUID: null, objectGUID }],
		});
		const idFor = async (objectGUID: Buffer | string) => {
			const { auth, clients } = make(CONFIG, ad(objectGUID));
			const id = (await auth.authenticate('ann', 'ann-pw'))?.objectId;
			return { id, searched: clients[0].searches[0].explicitBufferAttributes ?? [] };
		};
		const asBytes = await idFor(guid);
		expect(asBytes.id).toBe(key);
		// Whatever spelling the directory answers with, the bytes stay bytes.
		expect(asBytes.searched).toEqual(expect.arrayContaining(['objectGUID', 'objectguid', 'OBJECTGUID']));
		expect((await idFor('{67452301-AB89-EFCD-0123-456789ABCDEF}')).id).toBe(key);
		expect((await idFor('67452301-ab89-efcd-0123-456789abcdef')).id).toBe(key);
		// A proxy's textual GUID, delivered as the bytes of that text.
		expect((await idFor(Buffer.from('{67452301-ab89-efcd-0123-456789abcdef}'))).id).toBe(key);
		// The bytes decoded as UTF-8 (lossy: different GUIDs can read alike) are no id.
		expect((await idFor(guid.toString('utf8'))).id).toBeNull();
		expect((await idFor(Buffer.from('not a guid'))).id).toBeNull();
	});

	test('a client that cannot be made (a URL the validator let through) is "the directory could not be asked"', async () => {
		const auth = new LdapAuthenticator(CONFIG, () => {
			throw new Error('Invalid URL');
		});
		await expect(auth.lookup('alice')).rejects.toThrow(LdapUnavailableError);
		await expect(auth.authenticate('alice', 'alice-pw')).rejects.toThrow(LdapUnavailableError);
	});

	test('attribute names are trimmed: " uid " is uid', async () => {
		const { auth } = make({ ...CONFIG, username_attribute: ' uid ', email_attribute: ' mail ' });
		expect(await auth.authenticate('alice', 'alice-pw')).toMatchObject({
			username: 'alice',
			email: 'alice@example.com',
		});
	});

	test('attribute names are read ignoring case, as LDAP defines them', async () => {
		const { auth } = make({ ...CONFIG, username_attribute: 'UID', email_attribute: 'MAIL' });
		expect(await auth.authenticate('alice', 'alice-pw')).toMatchObject({
			username: 'alice',
			email: 'alice@example.com',
		});
	});

	test('both placeholders are substituted in one pass: a value containing "{{email}}" is searched as typed', async () => {
		const { auth, clients } = make({ ...CONFIG, search_filter: '(uid={{login}})' });
		await auth.authenticate('a{{email}}b', 'x');
		expect(clients[0].calls.find((c) => c.startsWith('search'))).toContain('(uid=a{{email}}b)');
	});

	test('the bind guard: a throttled entry is never bound; failures and success report the DN', async () => {
		const seen: string[] = [];
		const guard: LdapBindGuard = {
			allow: (dn) => !dn.startsWith('uid=bob'),
			failed: (dn) => seen.push(`failed ${dn}`),
			abandoned: (dn) => seen.push(`abandoned ${dn}`),
			succeeded: (dn) => seen.push(`ok ${dn}`),
		};
		const { auth, clients } = make();
		await expect(auth.authenticate('bob@example.com', 'bob pw with spaces', [], guard)).rejects.toThrow(
			LdapThrottledError
		);
		expect(clients[0].calls.some((c) => c.startsWith('bind uid=bob'))).toBe(false);
		expect(await auth.authenticate('alice', 'nope', [], guard)).toBeNull();
		expect((await auth.authenticate('alice@example.com', 'alice-pw', [], guard))?.username).toBe('alice');
		expect(seen).toEqual([
			'failed uid=alice,ou=people,dc=example,dc=com',
			'ok uid=alice,ou=people,dc=example,dc=com',
		]);
	});

	test('the bind guard: a bind that never left gives its reservation back; one sent without an answer does not', async () => {
		const seen: string[] = [];
		const guard: LdapBindGuard = {
			allow: () => true,
			failed: (dn) => seen.push(`failed ${dn}`),
			abandoned: (dn) => seen.push(`abandoned ${dn}`),
			succeeded: (dn) => seen.push(`ok ${dn}`),
		};
		const carl = (bindError: string | Error): FakeDirectory => ({
			...DIR,
			users: [{ dn: 'uid=carl,ou=people,dc=example,dc=com', password: 'carl-pw', bindError }],
		});
		const neverSent = [
			'Socket connection not established',
			'Connection timeout',
			'connect ECONNREFUSED 10.0.0.9:636',
			'LDAP connection dropped after StartTLS; not reconnecting in clear',
		];
		for (const message of neverSent) {
			await expect(make(CONFIG, carl(message)).auth.authenticate('carl', 'carl-pw', [], guard)).rejects.toThrow(
				LdapUnavailableError
			);
		}
		// Sent, no verdict: the directory may have checked and counted it.
		const unknown: (string | Error)[] = [
			// The directory's own answer, whatever diagnostic text it carries: it saw the bind.
			new BusyError('upstream connect ECONNREFUSED; try later'),
			'BindRequest: Operation timed out',
			'Connection closed before message response was received. Message type: BindRequest (0x60)',
			'socket hang up',
		];
		for (const message of unknown) {
			await expect(make(CONFIG, carl(message)).auth.authenticate('carl', 'carl-pw', [], guard)).rejects.toThrow(
				LdapUnavailableError
			);
		}
		expect(seen).toEqual(neverSent.map(() => 'abandoned uid=carl,ou=people,dc=example,dc=com'));
	});

	test('an entry with no mail attribute yields an identity without an email', async () => {
		const dir: FakeDirectory = {
			...DIR,
			users: [{ dn: 'uid=svc-deploy,ou=people,dc=example,dc=com', password: 'svc-pw', memberOf: [] }],
		};
		const { auth } = make({ ...CONFIG, default_role: 'operation' }, dir);
		expect(await auth.authenticate('svc-deploy', 'svc-pw')).toMatchObject({
			username: 'svc-deploy',
			email: null,
			fullName: 'svc-deploy',
			role: Role.Operation,
		});
	});

	test('alternatives: a bare name not in the directory is retried as the completed address, with one bind', async () => {
		const { auth, clients } = make();
		const id = await auth.authenticate('bob-typo', 'bob pw with spaces', ['bob@example.com']);
		expect(id?.username).toBe('bob');
		expect(clients[0].calls.filter((c) => c.startsWith('bind uid='))).toHaveLength(1);
	});

	test('a legacy mail-only filter still works for emails and simply finds no entry for a username', async () => {
		const { auth, clients } = make({ ...CONFIG, search_filter: '(mail={{email}})' });
		expect((await auth.authenticate('alice@example.com', 'alice-pw'))?.username).toBe('alice');
		expect(await auth.authenticate('alice', 'alice-pw')).toBeNull();
		expect(clients[1].calls.find((c) => c.startsWith('search'))).toContain('(mail=alice)');
	});

	test('an entry whose uid is not the typed username is refused, as a mail mismatch is', async () => {
		const dir: FakeDirectory = {
			...DIR,
			users: [{ ...DIR.users[0], uid: 'alice', searchAs: 'victim' }],
		};
		// The filter matches "victim" through the entry's self-edited extra value; the uid says alice.
		const { auth } = make({ ...CONFIG, search_filter: '(|(uid={{login}})(mail={{login}}))' }, dir);
		expect(await auth.authenticate('victim', 'alice-pw')).toBeNull();
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
	test('all steps pass and the user lookup reports the role they would get — by email or by username', async () => {
		const { auth } = make();
		const result = await auth.probe('alice@example.com');
		expect(result.ok).toBe(true);
		expect(result.steps.map((s) => s.step)).toEqual(['connect', 'service_bind', 'search_base', 'user_lookup']);
		expect(result.user).toMatchObject({ dn: 'uid=alice,ou=people,dc=example,dc=com', role: Role.Admin });
		const byName = await make().auth.probe('alice');
		expect(byName.ok).toBe(true);
		expect(byName.user).toMatchObject({ dn: 'uid=alice,ou=people,dc=example,dc=com', role: Role.Admin });
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

	test('an attribute name must be one: a list, or a name with a space, switches LDAP off with a reason', () => {
		const withAttribute = (username_attribute: unknown) =>
			resolveLdapConfig({
				enabled: true,
				url: 'ldaps://x',
				search_base: 'dc=x',
				default_role: 'viewer',
				username_attribute: username_attribute as string,
			});
		expect(withAttribute('uid').enabled).toBe(true);
		expect(withAttribute(' uid ')).toMatchObject({ enabled: true, username_attribute: 'uid' });
		expect(withAttribute('sAMAccountName').enabled).toBe(true);
		expect(withAttribute('0.9.2342.19200300.100.1.1').enabled).toBe(true);
		expect(withAttribute('cn;lang-en').enabled).toBe(true);
		expect(withAttribute(['uid', 'sAMAccountName']).enabled).toBe(false);
		expect(withAttribute('uid name').enabled).toBe(false);
		expect(withAttribute('(uid=*)').enabled).toBe(false);
	});

	test('the pre-username default filter in a config file is dropped so the current default applies', () => {
		const config = resolveLdapConfig({
			enabled: true,
			url: 'ldaps://x',
			search_base: 'dc=x',
			default_role: 'viewer',
			search_filter: '(mail={{email}})',
		});
		expect(config.enabled).toBe(true);
		expect(config.search_filter).toBeUndefined();
		expect(resolveLdapConfig({ enabled: false, search_filter: '(uid={{email}})' }).search_filter).toBe(
			'(uid={{email}})'
		);
		// YAML's empty value is null, a quoted one "": no filter either way, and no crash.
		expect(
			resolveLdapConfig({ enabled: false, search_filter: null as unknown as string }).search_filter
		).toBeUndefined();
		expect(resolveLdapConfig({ enabled: false, search_filter: '  ' }).search_filter).toBeUndefined();
		// The environment is a choice made now: email-only on purpose stays email-only.
		process.env.LDAP_SEARCH_FILTER = '(mail={{email}})';
		expect(resolveLdapConfig({ enabled: false }).search_filter).toBe('(mail={{email}})');
		delete process.env.LDAP_SEARCH_FILTER;
		// A filter that is not a string is a configuration problem, not a crash.
		expect(
			resolveLdapConfig({
				enabled: true,
				url: 'ldaps://x',
				search_base: 'dc=x',
				default_role: 'viewer',
				search_filter: 5 as unknown as string,
			}).enabled
		).toBe(false);
	});

	test('a blank attribute name means the default, not an attribute called ""', () => {
		const config = resolveLdapConfig({
			enabled: true,
			url: 'ldaps://x',
			search_base: 'dc=x',
			username_attribute: '',
			email_attribute: ' ',
		});
		expect(config.username_attribute).toBeUndefined();
		expect(config.email_attribute).toBeUndefined();
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
