import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { Role } from '@OpsiMate/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AuditBL } from '../src/bl/audit/audit.bl';
import {
	LdapAuthenticator,
	LdapBindGuard,
	LdapIdentity,
	LdapThrottledError,
	LdapUnavailableError,
} from '../src/bl/users/ldapAuthenticator';
import { DirectoryManagedError, TooManyLoginAttemptsError, UserBL } from '../src/bl/users/user.bl';
import { AuditLogRepository } from '../src/dal/auditLogRepository';
import { MailClient } from '../src/dal/external-client/mail-client';
import { PasswordResetsRepository } from '../src/dal/passwordResetsRepository';
import { UserRepository } from '../src/dal/userRepository';

// What the stub directory answers for each email/password pair.
interface StubAnswer {
	password: string;
	identity: LdapIdentity;
}

class StubDirectory {
	calls = 0;
	// Password checks that actually reached the directory.
	binds = 0;
	down = false;
	// The user bind breaks off (the connection, not the password) instead of a verdict.
	bindBroken = false;
	answers = new Map<string, StubAnswer>();
	authenticate(
		identifier: string,
		password: string,
		alternatives: string[] = [],
		guard?: LdapBindGuard
	): Promise<LdapIdentity | null> {
		this.calls++;
		if (this.down) return Promise.reject(new LdapUnavailableError('connect ECONNREFUSED'));
		const key = [identifier, ...alternatives].find((candidate) => this.answers.has(candidate));
		const answer = key ? this.answers.get(key) : undefined;
		if (!answer) return Promise.resolve(null);
		if (guard && !guard.allow(answer.identity.dn))
			return Promise.reject(new LdapThrottledError(answer.identity.dn));
		if (this.bindBroken) {
			guard?.abandoned(answer.identity.dn);
			return Promise.reject(new LdapUnavailableError('LDAP user bind failed: Socket connection not established'));
		}
		this.binds++;
		// The bind crosses the network: let the other attempts queue up behind it.
		return new Promise((resolve) => setTimeout(resolve, 5)).then(() => {
			if (answer.password !== password) {
				guard?.failed(answer.identity.dn);
				return null;
			}
			guard?.succeeded(answer.identity.dn);
			return answer.identity;
		});
	}
}

const identity = (email: string, fullName: string, role: Role | null): LdapIdentity => ({
	dn: `uid=${email.split('@')[0]},dc=example,dc=com`,
	objectId: `uuid-${email.split('@')[0]}`,
	username: email.split('@')[0],
	email,
	fullName,
	groups: [],
	role,
});

describe('UserBL login with LDAP', () => {
	let db: Database.Database;
	let userRepo: UserRepository;
	let userBL: UserBL;
	let directory: StubDirectory;
	let sendMail: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		db = new Database(':memory:');
		userRepo = new UserRepository(db);
		const passwordResetsRepo = new PasswordResetsRepository(db);
		const auditLogRepo = new AuditLogRepository(db);
		await Promise.all([
			userRepo.initUsersTable(),
			passwordResetsRepo.initPasswordResetsTable(),
			auditLogRepo.initAuditLogsTable(),
		]);
		sendMail = vi.fn().mockResolvedValue(undefined);
		const mailClient = { sendMail } as unknown as MailClient;
		userBL = new UserBL(userRepo, mailClient, passwordResetsRepo, new AuditBL(auditLogRepo));
		directory = new StubDirectory();
		directory.answers.set('dana@example.com', {
			password: 'dir-pw',
			identity: identity('dana@example.com', 'Dana Directory', Role.Editor),
		});
		directory.answers.set('nogroup@example.com', {
			password: 'dir-pw',
			identity: identity('nogroup@example.com', 'No Group', null),
		});
		userBL.setLdapAuthenticator(directory as unknown as LdapAuthenticator);
		const hash = await bcrypt.hash('local-pw', 4);
		await userRepo.createUser({
			username: 'admin',
			email: 'admin@example.com',
			passwordHash: hash,
			fullName: 'Local Admin',
			role: Role.Admin,
		});
	});

	afterEach(() => db.close());

	test("a provisioned directory account signs in by its username: the directory is asked by the account's address", async () => {
		await userBL.login('dana@example.com', 'dir-pw');
		// No default login domain here, so "dana" alone could not be completed to an address.
		const byName = await userBL.login('dana', 'dir-pw');
		expect(byName.email).toBe('dana@example.com');
		expect(byName.authSource).toBe('ldap');
		await expect(userBL.login('dana', 'wrong')).rejects.toThrow('Invalid username or password');
	});

	test('the throttle counts a login under every spelling: the typed name and the address it stands for', async () => {
		await userBL.login('dana@example.com', 'dir-pw');
		for (let i = 0; i < 3; i++) await expect(userBL.login('dana', 'wrong')).rejects.toThrow('Invalid');
		for (let i = 0; i < 2; i++) await expect(userBL.login('dana@example.com', 'wrong')).rejects.toThrow('Invalid');
		// Five failures in total across the two spellings: both are now throttled.
		await expect(userBL.login('dana', 'dir-pw')).rejects.toThrow(TooManyLoginAttemptsError);
		await expect(userBL.login('DANA@example.com', 'dir-pw')).rejects.toThrow(TooManyLoginAttemptsError);
	});

	test('a local account that merely has the typed name as its username does not block the directory login for <name>@<domain>', async () => {
		const passwordResetsRepo = new PasswordResetsRepository(db);
		const auditLogRepo = new AuditLogRepository(db);
		const withDomain = new UserBL(
			userRepo,
			{ sendMail } as unknown as MailClient,
			passwordResetsRepo,
			new AuditBL(auditLogRepo),
			'example.com'
		);
		withDomain.setLdapAuthenticator(directory as unknown as LdapAuthenticator);
		await userRepo.createUser({
			username: 'dana',
			email: 'dana@contractor.example',
			passwordHash: await bcrypt.hash('contractor-pw', 4),
			fullName: 'Dana Contractor',
			role: Role.Viewer,
		});
		// Company Dana's directory username is her own; the contractor merely has "dana".
		directory.answers.set('dana@example.com', {
			password: 'dir-pw',
			identity: { ...identity('dana@example.com', 'Dana Directory', Role.Editor), username: 'dlevi' },
		});
		// Legacy field, bare name: the contractor's password does not match, so the
		// directory is asked (for "dana", then dana@example.com) and provisions company Dana.
		const user = await withDomain.login('dana', 'dir-pw', { legacyEmailField: true });
		expect(user).toMatchObject({ email: 'dana@example.com', authSource: 'ldap', username: 'dlevi' });
		// A local account that owns the completed ADDRESS does block it.
		await userRepo.createUser({
			username: 'noa',
			email: 'noa@example.com',
			passwordHash: await bcrypt.hash('local-pw', 4),
			fullName: 'Noa Local',
			role: Role.Viewer,
		});
		directory.answers.set('noa@example.com', {
			password: 'dir-pw',
			identity: identity('noa@example.com', 'Noa Directory', Role.Editor),
		});
		const before = directory.calls;
		await expect(withDomain.login('noa', 'dir-pw', { legacyEmailField: true })).rejects.toThrow('Invalid');
		expect(directory.calls).toBe(before);
	});

	test('a directory login by username provisions the account under that username, with the directory email', async () => {
		directory.answers.set('noa', {
			password: 'dir-pw',
			identity: { ...identity('noa@example.com', 'Noa Directory', Role.Viewer), username: 'noa' },
		});
		const user = await userBL.login('Noa', 'dir-pw');
		expect(user).toMatchObject({
			username: 'noa',
			email: 'noa@example.com',
			authSource: 'ldap',
			role: Role.Viewer,
		});
		// Signs in again by email too: one account.
		directory.answers.set('noa@example.com', directory.answers.get('noa')!);
		expect((await userBL.login('noa@example.com', 'dir-pw')).id).toBe(user.id);
		expect(await userRepo.countUsers()).toBe(2);
	});

	test("an account provisioned before usernames takes the directory's username at its next login", async () => {
		// Provisioned from an email in the old days: username = local part.
		await userRepo.createUser({
			username: 'dana',
			email: 'dana@example.com',
			passwordHash: '!ldap',
			fullName: 'Dana Directory',
			role: Role.Editor,
			authSource: 'ldap',
			ldapDn: 'uid=dana,dc=example,dc=com',
		});
		directory.answers.set('dana@example.com', {
			password: 'dir-pw',
			identity: { ...identity('dana@example.com', 'Dana Directory', Role.Editor), username: 'dlevi' },
		});
		const user = await userBL.login('dana@example.com', 'dir-pw');
		expect(user.username).toBe('dlevi');
		expect(await userRepo.countUsers()).toBe(2);
		// The directory name now signs in too.
		directory.answers.set('dlevi', directory.answers.get('dana@example.com')!);
		expect((await userBL.login('dlevi', 'dir-pw')).id).toBe(user.id);
	});

	test('before the account exists, failures by username and by email count against the same directory entry', async () => {
		directory.answers.set('dana', directory.answers.get('dana@example.com')!);
		for (let i = 0; i < 3; i++) await expect(userBL.login('dana', 'wrong')).rejects.toThrow('Invalid');
		for (let i = 0; i < 2; i++) await expect(userBL.login('dana@example.com', 'wrong')).rejects.toThrow('Invalid');
		// Five failed binds for one entry, under two spellings: both are refused now.
		await expect(userBL.login('dana', 'dir-pw')).rejects.toThrow(TooManyLoginAttemptsError);
		await expect(userBL.login('dana@example.com', 'dir-pw')).rejects.toThrow(TooManyLoginAttemptsError);
		expect(await userRepo.countUsers()).toBe(1);
	});

	test('an entry whose username and address both changed keeps its account, found by its DN', async () => {
		const first = await userBL.login('dana@example.com', 'dir-pw');
		directory.answers.delete('dana@example.com');
		directory.answers.set('dlevi', {
			password: 'dir-pw',
			identity: {
				...identity('dana@example.com', 'Dana Levi', Role.Editor),
				username: 'dlevi',
				email: 'dlevi@example.com',
			},
		});
		const renamed = await userBL.login('dlevi', 'dir-pw');
		expect(renamed.id).toBe(first.id);
		expect(renamed).toMatchObject({ username: 'dlevi', email: 'dlevi@example.com' });
		expect(await userRepo.countUsers()).toBe(2);
	});

	test("a local account holding the directory's username does not hide the entry's own account reached by email", async () => {
		// The directory account was migrated as alex2 (a local alex already held the name).
		await userRepo.createUser({
			username: 'alex',
			email: 'alex@contractor.example',
			passwordHash: await bcrypt.hash('x', 4),
			fullName: 'Alex Local',
			role: Role.Viewer,
		});
		await userRepo.createUser({
			username: 'alex2',
			email: 'alex@example.com',
			passwordHash: '!ldap',
			fullName: 'Alex Directory',
			role: Role.Editor,
			authSource: 'ldap',
			ldapDn: 'uid=alex,dc=example,dc=com',
		});
		directory.answers.set('alex@example.com', {
			password: 'dir-pw',
			identity: { ...identity('alex@example.com', 'Alex Directory', Role.Editor), username: 'alex' },
		});
		const user = await userBL.login('alex@example.com', 'dir-pw');
		expect(user).toMatchObject({ username: 'alex2', email: 'alex@example.com', authSource: 'ldap' });
		expect((await userRepo.getUserByUsername('alex'))?.authSource).toBe('local');
	});

	test('an entry that lists no address keeps the stored one (unreadable mail must not strip everyone)', async () => {
		await userBL.login('dana@example.com', 'dir-pw');
		directory.answers.set('dana', {
			password: 'dir-pw',
			identity: { ...identity('dana@example.com', 'Dana Directory', Role.Editor), email: null },
		});
		expect((await userBL.login('dana', 'dir-pw')).email).toBe('dana@example.com');
		// Kept in the write itself, not copied from an earlier read: a sync without an
		// address leaves whatever another login saved in the meantime.
		const dana = await userRepo.getUserByUsername('dana');
		await userRepo.syncDirectoryUser(Number(dana!.id), 'Dana Directory', Role.Editor, 'raced@example.com', 'dana2');
		await userRepo.syncDirectoryUser(Number(dana!.id), 'Dana Renamed', Role.Editor, undefined, undefined);
		expect(await userRepo.getUserByUsername('dana2')).toMatchObject({
			fullName: 'Dana Renamed',
			email: 'raced@example.com',
		});
		await userRepo.syncDirectoryUser(Number(dana!.id), 'Dana Directory', Role.Editor, undefined, 'dana');
		// A changed address is followed.
		directory.answers.set('dana', {
			password: 'dir-pw',
			identity: { ...identity('dana@example.com', 'Dana Directory', Role.Editor), email: 'dana.new@example.com' },
		});
		expect((await userBL.login('dana', 'dir-pw')).email).toBe('dana.new@example.com');
	});

	test('concurrent wrong guesses for one entry reserve their attempts: no more binds than the limit reach the directory', async () => {
		directory.answers.set('dana', directory.answers.get('dana@example.com')!);
		const attempts = Array.from({ length: 8 }, (_, i) =>
			userBL.login(i % 2 ? 'dana' : 'dana@example.com', 'wrong')
		);
		const outcomes = await Promise.allSettled(attempts);
		const throttled = outcomes.filter(
			(o) => o.status === 'rejected' && (o.reason as Error) instanceof TooManyLoginAttemptsError
		).length;
		// Five reservations are all the limit allows; the other three never bound.
		expect(throttled).toBe(3);
		expect(directory.binds).toBe(5);
	});

	test('a bind the connection broke off is not a failed attempt: the budget is intact when the directory is back', async () => {
		directory.bindBroken = true;
		for (let i = 0; i < 7; i++) {
			await expect(userBL.login('dana@example.com', 'dir-pw')).rejects.toThrow(LdapUnavailableError);
		}
		directory.bindBroken = false;
		expect((await userBL.login('dana@example.com', 'dir-pw')).username).toBe('dana');
	});

	test("legacy email field: the completed address is checked first, even when the bare name is another directory account's username", async () => {
		// "alex" is user A's username (provisioned); alex@example.com belongs to user B.
		await userRepo.createUser({
			username: 'alex',
			email: 'alex.a@example.com',
			passwordHash: '!ldap',
			fullName: 'Alex A',
			role: Role.Viewer,
			authSource: 'ldap',
			ldapDn: 'uid=alex,dc=example,dc=com',
			ldapObjectId: 'uuid-alex',
		});
		directory.answers.set('alex@example.com', {
			password: 'b-pw',
			identity: {
				...identity('alex@example.com', 'Alex B', Role.Editor),
				username: 'alexb',
				dn: 'uid=alexb,dc=example,dc=com',
				objectId: 'uuid-alexb',
			},
		});
		// The directory answers for the bare name too (user A, same password), so the
		// winner shows which spelling was searched first.
		directory.answers.set('alex', {
			password: 'b-pw',
			identity: { ...identity('alex.a@example.com', 'Alex A', Role.Viewer), username: 'alex' },
		});
		const withDomain = new UserBL(
			userRepo,
			{ sendMail } as unknown as MailClient,
			new PasswordResetsRepository(db),
			new AuditBL(new AuditLogRepository(db)),
			'example.com'
		);
		withDomain.setLdapAuthenticator(directory as unknown as LdapAuthenticator);
		// User A's own address is over its budget: that is A's problem, not this login's,
		// which means alex@example.com.
		for (let i = 0; i < 5; i++) {
			await expect(withDomain.login('alex.a@example.com', 'wrong')).rejects.toThrow(
				'Invalid username or password'
			);
		}
		await expect(withDomain.login('alex.a@example.com', 'wrong')).rejects.toThrow(TooManyLoginAttemptsError);
		const b = await withDomain.login('alex', 'b-pw', { legacyEmailField: true });
		expect(b).toMatchObject({ username: 'alexb', email: 'alex@example.com' });
	});

	test('a known username whose directory object moved still signs in by that username; the new DN is recorded', async () => {
		await userBL.login('dana@example.com', 'dir-pw');
		directory.answers.set('dana', {
			password: 'dir-pw',
			identity: {
				...identity('dana@example.com', 'Dana Directory', Role.Editor),
				dn: 'uid=dana,ou=moved,dc=example,dc=com',
			},
		});
		const moved = await userBL.login('dana', 'dir-pw');
		expect(moved.username).toBe('dana');
		// Still one directory account (next to the local admin the fixture creates).
		expect(await userRepo.countUsers()).toBe(2);
		expect((await userRepo.findDirectoryLinkByUsername('dana'))?.ldapDn).toBe(
			'uid=dana,ou=moved,dc=example,dc=com'
		);
		// Another object at the account's old DN, with its username and address, is not it.
		directory.answers.set('dana', {
			password: 'dir-pw',
			identity: { ...identity('dana@example.com', 'Impostor', Role.Admin), objectId: 'uuid-impostor' },
		});
		await expect(userBL.login('dana', 'dir-pw')).rejects.toThrow('Invalid username or password');
	});

	test('an account linked before object ids were recorded is found at its DN even behind a newer object that once lived there', async () => {
		// An older object at the DN (its id known) and the legacy row at the same DN (no id).
		await userRepo.createUser({
			username: 'former',
			email: 'former@example.com',
			passwordHash: '!ldap',
			fullName: 'Former Occupant',
			role: Role.Viewer,
			authSource: 'ldap',
			ldapDn: 'uid=shared,dc=example,dc=com',
			ldapObjectId: 'uuid-former',
		});
		await userRepo.createUser({
			username: 'legacy',
			email: 'legacy@example.com',
			passwordHash: '!ldap',
			fullName: 'Legacy Link',
			role: Role.Viewer,
			authSource: 'ldap',
			ldapDn: 'uid=shared,dc=example,dc=com',
		});
		// The legacy account's object logs in with a new username and address.
		directory.answers.set('shared@example.com', {
			password: 'pw',
			identity: {
				...identity('shared@example.com', 'Legacy Renamed', Role.Editor),
				username: 'legacy2',
				dn: 'uid=shared,dc=example,dc=com',
				objectId: 'uuid-legacy',
			},
		});
		const user = await userBL.login('shared@example.com', 'pw');
		expect(user.fullName).toBe('Legacy Renamed');
		// No third directory account: the two rows above, plus the fixture's local admin.
		expect(await userRepo.countUsers()).toBe(3);
		expect(await userRepo.findDirectoryLinkByObjectId('uuid-legacy')).toMatchObject({
			ldapObjectId: 'uuid-legacy',
		});
		expect((await userRepo.findDirectoryLinkByUsername('former'))?.ldapObjectId).toBe('uuid-former');
	});

	test('one directory object, one account: the database refuses a second row for the same object id', async () => {
		const row = {
			passwordHash: '!ldap',
			fullName: 'Twice',
			role: Role.Viewer,
			authSource: 'ldap' as const,
			ldapDn: 'uid=twice,dc=example,dc=com',
			ldapObjectId: 'uuid-twice',
		};
		await userRepo.createUser({ ...row, username: 'twice', email: 'twice@example.com' });
		await expect(userRepo.createUser({ ...row, username: 'twice2', email: 'twice2@example.com' })).rejects.toThrow(
			/UNIQUE/
		);
		// Null ids are not compared: two local accounts, two directories without ids, fine.
		await userRepo.createUser({ ...row, username: 'noid1', email: null, ldapObjectId: undefined });
		await userRepo.createUser({ ...row, username: 'noid2', email: null, ldapObjectId: undefined });
	});

	test('a new entry at an old DN is not the old account: object ids tell them apart', async () => {
		const dana = await userBL.login('dana@example.com', 'dir-pw');
		directory.answers.set('eve@example.com', {
			password: 'eve-pw',
			identity: {
				...identity('eve@example.com', 'Eve', Role.Viewer),
				dn: 'uid=dana,dc=example,dc=com',
				objectId: 'uuid-eve',
			},
		});
		const eve = await userBL.login('eve@example.com', 'eve-pw');
		expect(eve.id).not.toBe(dana.id);
		expect((await userRepo.getUserById(Number(dana.id)))?.username).toBe('dana');
	});

	test('a directory entry with no email gets an account without one', async () => {
		directory.answers.set('svc', {
			password: 'dir-pw',
			identity: { ...identity('svc@example.com', 'Service', Role.Operation), username: 'svc', email: null },
		});
		const user = await userBL.login('svc', 'dir-pw');
		expect(user).toMatchObject({ username: 'svc', email: null, authSource: 'ldap' });
	});

	test("a directory entry with a local account's username cannot take that account over", async () => {
		// "admin" is the local admin's username.
		directory.answers.set('admin', {
			password: 'dir-pw',
			identity: { ...identity('admin@elsewhere.example', 'Impostor', Role.Admin), username: 'admin' },
		});
		await expect(userBL.login('admin', 'dir-pw')).rejects.toThrow('Invalid username or password');
		expect((await userRepo.getUserByUsername('admin'))?.authSource).toBe('local');
	});

	test('first directory login creates the account with the mapped role, marked ldap', async () => {
		const user = await userBL.login('Dana@Example.com', 'dir-pw');
		expect(user).toMatchObject({ email: 'dana@example.com', fullName: 'Dana Directory', role: Role.Editor });
		expect(user.authSource).toBe('ldap');
		expect(await userRepo.countUsers()).toBe(2);
	});

	test('later logins reuse the account and follow the directory (name, role)', async () => {
		const first = await userBL.login('dana@example.com', 'dir-pw');
		directory.answers.set('dana@example.com', {
			password: 'dir-pw',
			identity: identity('dana@example.com', 'Dana Renamed', Role.Viewer),
		});
		const second = await userBL.login('dana@example.com', 'dir-pw');
		expect(second.id).toBe(first.id);
		expect(second).toMatchObject({ fullName: 'Dana Renamed', role: Role.Viewer });
		expect(await userRepo.countUsers()).toBe(2);
	});

	test('wrong directory password and unknown users are "invalid"; nothing is created', async () => {
		await expect(userBL.login('dana@example.com', 'nope')).rejects.toThrow('Invalid username or password');
		await expect(userBL.login('ghost@example.com', 'x')).rejects.toThrow('Invalid username or password');
		expect(await userRepo.countUsers()).toBe(1);
	});

	test('in no mapped group → refused with its own message; nothing is created', async () => {
		await expect(userBL.login('nogroup@example.com', 'dir-pw')).rejects.toThrow(/not allowed/i);
		expect(await userRepo.countUsers()).toBe(1);
	});

	test('local accounts never ask the directory — the way in when LDAP is down', async () => {
		directory.down = true;
		const admin = await userBL.login('admin@example.com', 'local-pw');
		expect(admin.authSource).toBe('local');
		await expect(userBL.login('admin@example.com', 'wrong')).rejects.toThrow('Invalid username or password');
		expect(directory.calls).toBe(0);
		await expect(userBL.login('dana@example.com', 'dir-pw')).rejects.toBeInstanceOf(LdapUnavailableError);
	});

	test("a directory entry with a local account's email cannot take that account over", async () => {
		directory.answers.set('admin@example.com', {
			password: 'dir-pw',
			identity: identity('admin@example.com', 'Impostor', Role.Admin),
		});
		await expect(userBL.login('admin@example.com', 'dir-pw')).rejects.toThrow('Invalid username or password');
		expect(directory.calls).toBe(0);
		// Nor through the directory answering with a different email than the one typed.
		directory.answers.set('alias@example.com', {
			password: 'dir-pw',
			identity: identity('admin@example.com', 'Impostor', Role.Admin),
		});
		await expect(userBL.login('alias@example.com', 'dir-pw')).rejects.toThrow('Invalid username or password');
		const admin = await userRepo.getUserByEmail('admin@example.com');
		expect(admin).toMatchObject({ fullName: 'Local Admin', authSource: 'local' });
	});

	test('with LDAP switched off, directory accounts cannot sign in (their stored hash is unusable)', async () => {
		await userBL.login('dana@example.com', 'dir-pw');
		userBL.setLdapAuthenticator(null);
		await expect(userBL.login('dana@example.com', 'dir-pw')).rejects.toThrow('Invalid username or password');
		await expect(userBL.login('dana@example.com', '!ldap')).rejects.toThrow('Invalid username or password');
	});

	test('passwords and emails of directory accounts are managed by the directory', async () => {
		const dana = await userBL.login('dana@example.com', 'dir-pw');
		const id = Number(dana.id);
		await expect(userBL.resetUserPassword(id, 'newpassword1')).rejects.toBeInstanceOf(DirectoryManagedError);
		await expect(userBL.updateProfile(id, 'Dana', 'newpassword1')).rejects.toBeInstanceOf(DirectoryManagedError);
		await expect(userBL.updateUser(id, { email: 'other@example.com' })).rejects.toBeInstanceOf(
			DirectoryManagedError
		);
		// Name/phone edits and role changes stay allowed (the next login re-syncs the role).
		await expect(userBL.updateUser(id, { fullName: 'Dana E', email: 'dana@example.com' })).resolves.toMatchObject({
			fullName: 'Dana E',
		});
		await expect(userBL.updateProfile(id, 'Dana D')).resolves.toMatchObject({ fullName: 'Dana D' });
		await expect(userBL.updateUser(id, { role: Role.Viewer })).resolves.toMatchObject({ role: Role.Viewer });
	});

	test('forgot-password for a directory account sends nothing', async () => {
		await userBL.login('dana@example.com', 'dir-pw');
		await userBL.forgotPassword('dana@example.com');
		expect(sendMail).not.toHaveBeenCalled();
	});

	test('an account stays with its directory object: another entry with the same email is refused, the same object moved is not', async () => {
		await userBL.login('dana@example.com', 'dir-pw');
		// A different object (new entryUUID) that now lists her address.
		directory.answers.set('dana@example.com', {
			password: 'dir-pw',
			identity: {
				...identity('dana@example.com', 'New Dana', Role.Admin),
				dn: 'uid=dana2,dc=example,dc=com',
				objectId: 'uuid-someone-else',
			},
		});
		await expect(userBL.login('dana@example.com', 'dir-pw')).rejects.toThrow('Invalid username or password');
		expect(await userRepo.getUserByEmail('dana@example.com')).toMatchObject({ fullName: 'Dana Directory' });
		// The same object (same entryUUID) moved to another DN is still her account.
		directory.answers.set('dana@example.com', {
			password: 'dir-pw',
			identity: {
				...identity('dana@example.com', 'Dana Moved', Role.Editor),
				dn: 'uid=dana,ou=moved,dc=example,dc=com',
			},
		});
		const moved = await userBL.login('dana@example.com', 'dir-pw');
		expect(moved.fullName).toBe('Dana Moved');
		expect(await userRepo.countUsers()).toBe(2);
	});

	test('a local account is protected whatever the letter case of its email', async () => {
		await userRepo.createUser({
			username: 'case',
			email: 'Case@Example.com',
			passwordHash: await bcrypt.hash('x', 4),
			fullName: 'Local Case',
			role: Role.Viewer,
		});
		directory.answers.set('case@example.com', {
			password: 'dir-pw',
			identity: identity('case@example.com', 'Directory Case', Role.Admin),
		});
		await expect(userBL.login('case@example.com', 'dir-pw')).rejects.toThrow('Invalid username or password');
		expect(await userRepo.countUsers()).toBe(2);
	});

	test('two simultaneous first logins end up in one account', async () => {
		const [a, b] = await Promise.all([
			userBL.login('dana@example.com', 'dir-pw'),
			userBL.login('dana@example.com', 'dir-pw'),
		]);
		expect(a.id).toBe(b.id);
		expect(await userRepo.countUsers()).toBe(2);
	});

	test('after 5 failed directory logins the email is throttled without asking the directory', async () => {
		for (let i = 0; i < 5; i++) {
			await expect(userBL.login('dana@example.com', 'wrong')).rejects.toThrow('Invalid username or password');
		}
		const callsBefore = directory.calls;
		await expect(userBL.login('Dana@example.com', 'dir-pw')).rejects.toBeInstanceOf(TooManyLoginAttemptsError);
		expect(directory.calls).toBe(callsBefore);
		// Local accounts are not affected by directory throttling.
		await expect(userBL.login('admin@example.com', 'local-pw')).resolves.toMatchObject({ authSource: 'local' });
		// Other directory users are not affected either.
		await expect(userBL.login('nogroup@example.com', 'dir-pw')).rejects.toThrow(/not allowed/i);
	});

	test('a successful directory login clears earlier failures', async () => {
		for (let i = 0; i < 4; i++) await expect(userBL.login('dana@example.com', 'wrong')).rejects.toThrow();
		await userBL.login('dana@example.com', 'dir-pw');
		for (let i = 0; i < 4; i++) await expect(userBL.login('dana@example.com', 'wrong')).rejects.toThrow();
		await expect(userBL.login('dana@example.com', 'dir-pw')).resolves.toMatchObject({ email: 'dana@example.com' });
	});

	test('login_max_failures sets the threshold, and 0 turns the throttle off', async () => {
		userBL.setLdapAuthenticator(directory as unknown as LdapAuthenticator, 2);
		for (let i = 0; i < 2; i++) await expect(userBL.login('dana@example.com', 'wrong')).rejects.toThrow();
		await expect(userBL.login('dana@example.com', 'dir-pw')).rejects.toBeInstanceOf(TooManyLoginAttemptsError);

		userBL.setLdapAuthenticator(directory as unknown as LdapAuthenticator, 0);
		for (let i = 0; i < 20; i++) {
			await expect(userBL.login('dana@example.com', 'wrong')).rejects.toThrow('Invalid username or password');
		}
		await expect(userBL.login('dana@example.com', 'dir-pw')).resolves.toMatchObject({ email: 'dana@example.com' });
	});

	test('re-applying settings with the same limit keeps the failure counters', async () => {
		for (let i = 0; i < 4; i++) await expect(userBL.login('dana@example.com', 'wrong')).rejects.toThrow();
		userBL.setLdapAuthenticator(directory as unknown as LdapAuthenticator, 5);
		await expect(userBL.login('dana@example.com', 'wrong')).rejects.toThrow('Invalid username or password');
		await expect(userBL.login('dana@example.com', 'dir-pw')).rejects.toBeInstanceOf(TooManyLoginAttemptsError);
	});
});
