import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { Role } from '@OpsiMate/shared';
import { AuditBL } from '../src/bl/audit/audit.bl';
import { WebhookOwnerResolver } from '../src/bl/alerts/webhookOwnerResolver';
import { LdapAuthenticator, LdapIdentity, LdapUnavailableError } from '../src/bl/users/ldapAuthenticator';
import { UserBL } from '../src/bl/users/user.bl';
import { AuditLogRepository } from '../src/dal/auditLogRepository';
import { MailClient } from '../src/dal/external-client/mail-client';
import { PasswordResetsRepository } from '../src/dal/passwordResetsRepository';
import { UserRepository } from '../src/dal/userRepository';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// A webhook names the alert's owner. The value becomes an assignment when it names a
// user; a directory user who never logged in is provisioned for it; it fills an empty
// owner only and never unassigns; and nothing about it can fail the webhook.

describe('owner from the webhook (API)', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let jwt: string;
	let adminId: string;
	const API_TOKEN = 'opsimate';

	const post = (path: string, body: object) => app.post(`${path}?api_token=${API_TOKEN}`).send(body);
	interface OwnedAlert {
		ownerId: string | null;
	}
	const alertById = async (id: string): Promise<OwnedAlert> => {
		const res = await app.get(`/api/v1/alerts/${id}`).set('Authorization', `Bearer ${jwt}`);
		const data = res.body.data as { alert?: OwnedAlert } & OwnedAlert;
		return data.alert ?? data;
	};
	const historyOf = async (id: string): Promise<string[]> => {
		const res = await app.get(`/api/v1/alerts/${id}/history`).set('Authorization', `Bearer ${jwt}`);
		const data = res.body.data as { data?: { description: string }[] } | { description: string }[];
		const events = Array.isArray(data) ? data : (data.data ?? []);
		return events.map((e) => e.description);
	};

	beforeAll(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		jwt = await setupUserWithToken(app);
		// The token's payload is the signed-in user (see loginHandler).
		adminId = String((JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString()) as { id: number }).id);
		// A second local user, to show the webhook never replaces an existing owner.
		await app
			.post('/api/v1/users')
			.set('Authorization', `Bearer ${jwt}`)
			.send({ email: 'dana@example.com', fullName: 'Dana', password: 'securepassword', role: 'viewer' });
	});

	afterAll(() => db.close());

	beforeEach(() => {
		db.exec('DELETE FROM alerts');
	});

	const custom = (id: string, extra: object = {}) => ({
		id,
		alertName: 'Disk full',
		tags: { env: 'prod' },
		summary: 'disk',
		...extra,
	});

	test('a top-level owner (email, any letter case) assigns a local user, with a history line and no callback event', async () => {
		const res = await post('/api/v1/alerts/custom', custom('w-1', { owner: 'Dana@Example.com' }));
		expect(res.status).toBe(200);
		expect(res.body.data.owner).toBe('assigned');
		const alert = await alertById('w-1');
		expect(alert.ownerId).not.toBeNull();
		expect(alert.ownerId).not.toBe(adminId);
		expect(await historyOf('w-1')).toContain('Assigned to Dana from the Custom webhook');
	});

	test('a re-send without an owner keeps the owner; with another owner it is kept too', async () => {
		await post('/api/v1/alerts/custom', custom('w-2', { owner: 'dana@example.com' }));
		const silent = await post('/api/v1/alerts/custom', custom('w-2'));
		expect(silent.body.data.owner).toBeUndefined();
		const other = await post('/api/v1/alerts/custom', custom('w-2', { owner: 'admin@example.com' }));
		expect(other.body.data.owner).toBe('kept');
		const alert = await alertById('w-2');
		expect(alert.ownerId).not.toBe(adminId);
	});

	test('a manual assignment is never overwritten by a later webhook', async () => {
		await post('/api/v1/alerts/custom', custom('w-3'));
		expect((await alertById('w-3')).ownerId).toBeNull();
		await app
			.post('/api/v1/alerts/bulk')
			.set('Authorization', `Bearer ${jwt}`)
			.send({ action: 'assignOwner', ids: ['w-3'], ownerId: adminId });
		expect((await alertById('w-3')).ownerId).toBe(adminId);
		const res = await post('/api/v1/alerts/custom', custom('w-3', { owner: 'dana@example.com' }));
		expect(res.body.data.owner).toBe('kept');
		expect((await alertById('w-3')).ownerId).toBe(adminId);
	});

	test('an unknown owner, or a bare name with no default domain, leaves the alert unassigned — and still 200', async () => {
		const unknown = await post('/api/v1/alerts/custom', custom('w-4', { owner: 'nobody@example.com' }));
		expect(unknown.status).toBe(200);
		expect(unknown.body.data.owner).toBe('not_found');
		expect((await alertById('w-4')).ownerId).toBeNull();
		const bare = await post('/api/v1/alerts/custom', custom('w-5', { owner: 'dana' }));
		expect(bare.body.data.owner).toBe('not_found');
	});

	test('an owner tag works for the sources without a field — Grafana labels here', async () => {
		const res = await post('/api/v1/alerts/custom/grafana', {
			alerts: [
				{
					status: 'firing',
					fingerprint: 'g-1',
					labels: { alertname: 'CPU', owner: 'dana@example.com' },
					annotations: { summary: 'cpu' },
				},
				{ status: 'firing', fingerprint: 'g-2', labels: { alertname: 'MEM' }, annotations: {} },
			],
		});
		expect(res.status).toBe(200);
		expect(res.body.data.processed).toEqual(['g-1', 'g-2']);
		expect(res.body.data.owners).toEqual({ 'g-1': 'assigned' });
		expect((await alertById('g-1')).ownerId).not.toBeNull();
		expect((await alertById('g-2')).ownerId).toBeNull();
	});

	test('a resolve payload ignores owner', async () => {
		await post('/api/v1/alerts/custom', custom('w-6'));
		const res = await post('/api/v1/alerts/custom', { id: 'w-6', status: 'resolved', owner: 'dana@example.com' });
		expect(res.status).toBe(200);
		expect(res.body.data.owner).toBeUndefined();
	});
});

describe('owner from the webhook (directory users)', () => {
	let db: Database.Database;
	let userRepo: UserRepository;
	let userBL: UserBL;
	const lookups: string[] = [];
	let directoryDown = false;

	const directory = {
		lookup(email: string): Promise<LdapIdentity | null> {
			lookups.push(email);
			if (directoryDown) return Promise.reject(new LdapUnavailableError('connect ECONNREFUSED'));
			if (email === 'dana@acme.test') {
				return Promise.resolve({
					dn: 'cn=dana,dc=x',
					email,
					fullName: 'Dana Directory',
					groups: [],
					role: Role.Editor,
				});
			}
			if (email === 'guest@acme.test') {
				return Promise.resolve({ dn: 'cn=guest,dc=x', email, fullName: 'Guest', groups: [], role: null });
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

	afterAll(() => db.close());

	beforeEach(() => {
		db.exec('DELETE FROM users');
		lookups.length = 0;
		directoryDown = false;
	});

	test('a directory user who never logged in is provisioned (as a first login would) and returned', async () => {
		const resolver = new WebhookOwnerResolver(userBL, () => 'acme.test');
		const user = await resolver.resolve('dana');
		expect(user?.email).toBe('dana@acme.test');
		expect(user?.fullName).toBe('Dana Directory');
		expect(user?.role).toBe(Role.Editor);
		expect(user?.authSource).toBe('ldap');
		// Second ask within the window: the cache answers; the directory is not called again.
		expect((await resolver.resolve('Dana@acme.test'))?.id).toBe(user?.id);
		expect(lookups).toEqual(['dana@acme.test']);
	});

	test('in no mapped group → nobody; unknown → nobody; a local account wins without asking the directory', async () => {
		const resolver = new WebhookOwnerResolver(userBL, () => 'acme.test');
		expect(await resolver.resolve('guest')).toBeNull();
		expect(await resolver.resolve('nobody')).toBeNull();
		await userRepo.createUser('local@acme.test', 'hash', 'Local', Role.Viewer);
		expect((await resolver.resolve('local'))?.email).toBe('local@acme.test');
		expect(lookups).toEqual(['guest@acme.test', 'nobody@acme.test']);
	});

	test('a directory that is down means no owner, not an error; a bare name with no default domain is never looked up', async () => {
		directoryDown = true;
		const resolver = new WebhookOwnerResolver(userBL, () => 'acme.test');
		await expect(resolver.resolve('dana')).resolves.toBeNull();
		const noDomain = new WebhookOwnerResolver(userBL, () => null);
		directoryDown = false;
		expect(await noDomain.resolve('dana')).toBeNull();
		expect(lookups).toEqual(['dana@acme.test']);
	});
});
