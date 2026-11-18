import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { SuperTest, Test } from 'supertest';
import { Role } from '@OpsiMate/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { AuditBL } from '../src/bl/audit/audit.bl';
import { LdapAuthenticator, LdapIdentity } from '../src/bl/users/ldapAuthenticator';
import { completeLoginIdentifier, UserBL } from '../src/bl/users/user.bl';
import { AuditLogRepository } from '../src/dal/auditLogRepository';
import { MailClient } from '../src/dal/external-client/mail-client';
import { PasswordResetsRepository } from '../src/dal/passwordResetsRepository';
import { UserRepository } from '../src/dal/userRepository';
import { setupDB, setupExpressApp } from './setup';

// login.default_email_domain: a bare name typed at login means <name>@<domain>, so nobody
// types their full address every day. Local and directory accounts alike; anything with
// an "@" is taken as typed; without the setting nothing changes.

describe('completeLoginIdentifier', () => {
	test('adds the domain to a bare name, leaves an email alone, does nothing without a domain', () => {
		expect(completeLoginIdentifier('idan', 'acme.test')).toBe('idan@acme.test');
		expect(completeLoginIdentifier('  Idan ', 'acme.test')).toBe('Idan@acme.test');
		expect(completeLoginIdentifier('idan@other.test', 'acme.test')).toBe('idan@other.test');
		expect(completeLoginIdentifier('idan', null)).toBe('idan');
		expect(completeLoginIdentifier('', 'acme.test')).toBe('');
	});
});

describe('UserBL login with a default domain', () => {
	let db: Database.Database;
	let userRepo: UserRepository;
	let userBL: UserBL;
	const ldapSeen: string[] = [];

	// Records every spelling the directory is asked for: the typed name first, then the
	// address the default domain completes it to.
	const directory = {
		authenticate(identifier: string, password: string, alternatives: string[] = []): Promise<LdapIdentity | null> {
			const asked = [identifier, ...alternatives];
			ldapSeen.push(...asked);
			if (asked.includes('dana@acme.test') && password === 'dir-pw') {
				return Promise.resolve({
					dn: 'cn=dana,dc=x',
					objectId: 'uuid-dana',
					username: 'dana',
					email: 'dana@acme.test',
					fullName: 'Dana',
					groups: [],
					role: Role.Viewer,
				});
			}
			return Promise.resolve(null);
		},
	} as unknown as LdapAuthenticator;

	beforeAll(async () => {
		db = new Database(':memory:');
		userRepo = new UserRepository(db);
		const passwordResetsRepo = new PasswordResetsRepository(db);
		const auditLogRepo = new AuditLogRepository(db);
		await Promise.all([
			userRepo.initUsersTable(),
			passwordResetsRepo.initPasswordResetsTable(),
			auditLogRepo.initAuditLogsTable(),
		]);
		const mailClient = { sendMail: vi.fn() } as unknown as MailClient;
		userBL = new UserBL(userRepo, mailClient, passwordResetsRepo, new AuditBL(auditLogRepo), 'acme.test');
		userBL.setLdapAuthenticator(directory, 0);
	});

	beforeEach(async () => {
		db.exec('DELETE FROM users');
		ldapSeen.length = 0;
		await userRepo.createUser({
			username: 'idan',
			email: 'idan@acme.test',
			passwordHash: await bcrypt.hash('local-pw', 4),
			fullName: 'Idan',
			role: Role.Admin,
		});
	});

	afterAll(() => db.close());

	test('a local account signs in with the bare name, the full email, or the email in another case', async () => {
		expect((await userBL.login('idan', 'local-pw')).email).toBe('idan@acme.test');
		expect((await userBL.login('idan@acme.test', 'local-pw')).email).toBe('idan@acme.test');
		expect((await userBL.login('IDAN', 'local-pw')).email).toBe('idan@acme.test');
		await expect(userBL.login('idan', 'wrong')).rejects.toThrow('Invalid');
	});

	test('a directory user types the bare name (legacy email field); the directory is asked for the completed email', async () => {
		const user = await userBL.login('dana', 'dir-pw', { legacyEmailField: true });
		expect(user.email).toBe('dana@acme.test');
		expect(user.username).toBe('dana');
		// Legacy field: the address it always meant first, then the name itself.
		expect(ldapSeen).toEqual(['dana@acme.test', 'dana']);
	});

	test('two Danas: the legacy email field keeps meaning <name>@<domain>; the login field means the username', async () => {
		// The contractor's email got "dana" at migration; company Dana is dana@acme.test.
		db.exec('DELETE FROM users');
		const sharedPassword = await bcrypt.hash('same-pw', 4);
		const contractor = await userRepo.createUser({
			username: 'dana',
			email: 'dana@contractor.test',
			passwordHash: sharedPassword,
			fullName: 'Dana Contractor',
			role: Role.Viewer,
		});
		await userRepo.createUser({
			username: 'dana2',
			email: 'dana@acme.test',
			passwordHash: sharedPassword,
			fullName: 'Dana Company',
			role: Role.Editor,
		});
		const legacy = { legacyEmailField: true };
		// Same password on both: the field decides who signs in.
		expect((await userBL.login('dana', 'same-pw', legacy)).email).toBe('dana@acme.test');
		expect((await userBL.login('dana', 'same-pw')).email).toBe('dana@contractor.test');
		// Through the legacy field the contractor is still reachable by password; through
		// the login field "dana" is only ever the contractor's username.
		await userRepo.updateUserPassword(contractor.lastID, await bcrypt.hash('contractor-pw', 4));
		expect((await userBL.login('dana', 'contractor-pw', legacy)).email).toBe('dana@contractor.test');
		await expect(userBL.login('dana', 'same-pw', { legacyEmailField: false })).rejects.toThrow('Invalid');
		expect((await userBL.login('dana2', 'same-pw')).email).toBe('dana@acme.test');
		// Both are local: the directory was never asked.
		expect(ldapSeen).toEqual([]);
	});

	test("through the login field a bare name is one account: a local holder's wrong password never reaches the directory", async () => {
		db.exec('DELETE FROM users');
		await userRepo.createUser({
			username: 'dana',
			email: 'dana@contractor.test',
			passwordHash: await bcrypt.hash('contractor-pw', 4),
			fullName: 'Dana Contractor',
			role: Role.Viewer,
		});
		// dana@acme.test is a directory user with password dir-pw; typing "dana" + dir-pw in
		// the login field must not sign in as her — "dana" is the contractor's username.
		await expect(userBL.login('dana', 'dir-pw')).rejects.toThrow('Invalid');
		expect(ldapSeen).toEqual([]);
		// An unknown bare name is asked of the directory as a username only — never
		// completed to an address through the login field.
		await expect(userBL.login('nobody', 'dir-pw')).rejects.toThrow('Invalid');
		expect(ldapSeen).toEqual(['nobody']);
		// The legacy field still completes it and asks the directory — which answers with the
		// username "dana", the contractor's: a directory entry never takes a local account's
		// username, so this login is refused at provisioning.
		await expect(userBL.login('dana', 'dir-pw', { legacyEmailField: true })).rejects.toThrow('Invalid');
		expect(ldapSeen).toEqual(['nobody', 'dana@acme.test', 'dana']);
	});

	test('a name with its own domain is not rewritten', async () => {
		await expect(userBL.login('idan@other.test', 'local-pw')).rejects.toThrow('Invalid');
		expect(ldapSeen).toEqual(['idan@other.test']);
	});
});

describe('login API without a default domain', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	// The app reads LOGIN_DEFAULT_EMAIL_DOMAIN when it is built: a developer's shell that
	// has it set would make "admin" resolve, and the 401 below a 200.
	const envDomain = process.env.LOGIN_DEFAULT_EMAIL_DOMAIN;

	beforeAll(async () => {
		delete process.env.LOGIN_DEFAULT_EMAIL_DOMAIN;
		db = await setupDB();
		app = await setupExpressApp(db);
		await app
			.post('/api/v1/users/register')
			.send({ email: 'admin@acme.test', fullName: 'Admin', password: 'securepassword' });
	});

	afterAll(() => {
		if (envDomain !== undefined) process.env.LOGIN_DEFAULT_EMAIL_DOMAIN = envDomain;
		db.close();
	});

	test('a bare name is a username first: the address local part signs in with no domain configured', async () => {
		// Registered by email only, so the username is the local part ("admin").
		const asUsername = await app.post('/api/v1/users/login').send({ email: 'admin', password: 'securepassword' });
		expect(asUsername.status).toBe(200);
		expect(asUsername.body.data.username).toBe('admin');
		const viaIdentifier = await app
			.post('/api/v1/users/login')
			.send({ identifier: 'Admin', password: 'securepassword' });
		expect(viaIdentifier.status).toBe(200);
	});

	test('an unknown bare name is not a validation error — it is simply not a known login', async () => {
		const res = await app.post('/api/v1/users/login').send({ email: 'nobody', password: 'securepassword' });
		expect(res.status).toBe(401);
		const ok = await app.post('/api/v1/users/login').send({ email: 'admin@acme.test', password: 'securepassword' });
		expect(ok.status).toBe(200);
	});

	test('email-status does not expose the default domain: the login form has no use for it', async () => {
		const res = await app.get('/email-status');
		expect(res.status).toBe(200);
		expect(res.body.data).not.toHaveProperty('loginDefaultEmailDomain');
	});
});
