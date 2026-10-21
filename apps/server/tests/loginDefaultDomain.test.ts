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

	// Records the email the directory is asked for: the point of the test is that it is the
	// completed one.
	const directory = {
		authenticate(email: string, password: string): Promise<LdapIdentity | null> {
			ldapSeen.push(email);
			if (email === 'dana@acme.test' && password === 'dir-pw') {
				return Promise.resolve({ dn: 'cn=dana,dc=x', email, fullName: 'Dana', groups: [], role: Role.Viewer });
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
		await userRepo.createUser('idan@acme.test', await bcrypt.hash('local-pw', 4), 'Idan', Role.Admin);
	});

	afterAll(() => db.close());

	test('a local account signs in with the bare name, the full email, or the email in another case', async () => {
		expect((await userBL.login('idan', 'local-pw')).email).toBe('idan@acme.test');
		expect((await userBL.login('idan@acme.test', 'local-pw')).email).toBe('idan@acme.test');
		expect((await userBL.login('IDAN', 'local-pw')).email).toBe('idan@acme.test');
		await expect(userBL.login('idan', 'wrong')).rejects.toThrow('Invalid');
	});

	test('a directory user types the bare name; the directory is asked for the completed email', async () => {
		const user = await userBL.login('dana', 'dir-pw');
		expect(user.email).toBe('dana@acme.test');
		expect(ldapSeen).toEqual(['dana@acme.test']);
	});

	test('a name with its own domain is not rewritten', async () => {
		await expect(userBL.login('idan@other.test', 'local-pw')).rejects.toThrow('Invalid');
		expect(ldapSeen).toEqual(['idan@other.test']);
	});
});

describe('login API without a default domain', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;

	beforeAll(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		await app
			.post('/api/v1/users/register')
			.send({ email: 'admin@acme.test', fullName: 'Admin', password: 'securepassword' });
	});

	afterAll(() => db.close());

	test('a bare name is not a validation error — it is simply not a known login', async () => {
		const res = await app.post('/api/v1/users/login').send({ email: 'admin', password: 'securepassword' });
		expect(res.status).toBe(401);
		const ok = await app.post('/api/v1/users/login').send({ email: 'admin@acme.test', password: 'securepassword' });
		expect(ok.status).toBe(200);
	});

	test('email-status tells the login page whether a default domain is set', async () => {
		const res = await app.get('/email-status');
		expect(res.status).toBe(200);
		expect(res.body.data).toHaveProperty('loginDefaultEmailDomain');
	});
});
