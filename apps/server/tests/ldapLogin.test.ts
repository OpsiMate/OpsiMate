import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { Role } from '@OpsiMate/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AuditBL } from '../src/bl/audit/audit.bl';
import { LdapAuthenticator, LdapIdentity, LdapUnavailableError } from '../src/bl/users/ldapAuthenticator';
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
	down = false;
	answers = new Map<string, StubAnswer>();
	authenticate(identifier: string, password: string, alternatives: string[] = []): Promise<LdapIdentity | null> {
		this.calls++;
		if (this.down) return Promise.reject(new LdapUnavailableError('connect ECONNREFUSED'));
		const key = [identifier, ...alternatives].find((candidate) => this.answers.has(candidate));
		const answer = key ? this.answers.get(key) : undefined;
		return Promise.resolve(answer && answer.password === password ? answer.identity : null);
	}
}

const identity = (email: string, fullName: string, role: Role | null): LdapIdentity => ({
	dn: `uid=${email.split('@')[0]},dc=example,dc=com`,
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

	test('an account stays with its directory entry: another DN with the same email is refused', async () => {
		await userBL.login('dana@example.com', 'dir-pw');
		directory.answers.set('dana@example.com', {
			password: 'dir-pw',
			identity: { ...identity('dana@example.com', 'New Dana', Role.Admin), dn: 'uid=dana2,dc=example,dc=com' },
		});
		await expect(userBL.login('dana@example.com', 'dir-pw')).rejects.toThrow('Invalid username or password');
		expect(await userRepo.getUserByEmail('dana@example.com')).toMatchObject({ fullName: 'Dana Directory' });
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
