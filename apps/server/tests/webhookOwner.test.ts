import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { SuperTest, Test } from 'supertest';
import Database from 'better-sqlite3';
import { Role } from '@OpsiMate/shared';
import { AlertStatus } from '@OpsiMate/shared';
import { AlertBL, IncomingAlert } from '../src/bl/alerts/alert.bl';
import { AuditBL } from '../src/bl/audit/audit.bl';
import { AlertRepository } from '../src/dal/alertRepository';
import { AlertCommentsRepository } from '../src/dal/alertCommentsRepository';
import { AlertHistoryRepository } from '../src/dal/alertHistoryRepository';
import { ResolvedAlertRepository } from '../src/dal/resolvedAlertRepository';
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
// owner only and a changed name never replaces one; sent EMPTY ("" or null) it removes
// the owner — also one set by hand — and takes the alert out of its incident; absent, it
// is silence. Nothing about it can fail the webhook.

describe('owner from the webhook (API)', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let jwt: string;
	let adminId: string;
	const API_TOKEN = 'opsimate';

	const post = (path: string, body: object) => app.post(`${path}?api_token=${API_TOKEN}`).send(body);
	interface OwnedAlert {
		ownerId: string | null;
		incidentId?: number | null;
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

	test('an unknown owner leaves the alert unassigned — and still 200; a bare name is a username', async () => {
		const unknown = await post('/api/v1/alerts/custom', custom('w-4', { owner: 'nobody@example.com' }));
		expect(unknown.status).toBe(200);
		expect(unknown.body.data.owner).toBe('not_found');
		expect((await alertById('w-4')).ownerId).toBeNull();
		const unknownName = await post('/api/v1/alerts/custom', custom('w-5', { owner: 'nobody' }));
		expect(unknownName.body.data.owner).toBe('not_found');
		// "dana" is dana@example.com's username (the local part), with no default domain set.
		const byUsername = await post('/api/v1/alerts/custom', custom('w-5b', { owner: 'Dana' }));
		expect(byUsername.body.data.owner).toBe('assigned');
		expect((await alertById('w-5b')).ownerId).not.toBeNull();
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

	test('an EMPTY owner ("" or null) removes the owner — also one set by hand — with a history line', async () => {
		await post('/api/v1/alerts/custom', custom('w-10', { owner: 'dana@example.com' }));
		expect((await alertById('w-10')).ownerId).not.toBeNull();
		const cleared = await post('/api/v1/alerts/custom', custom('w-10', { owner: '' }));
		expect(cleared.status).toBe(200);
		expect(cleared.body.data.owner).toBe('unassigned');
		expect((await alertById('w-10')).ownerId).toBeNull();
		expect(await historyOf('w-10')).toContain('Owner removed');
		// A manual assignment goes the same way when the sender says so explicitly.
		await app
			.post('/api/v1/alerts/bulk')
			.set('Authorization', `Bearer ${jwt}`)
			.send({ action: 'assignOwner', ids: ['w-10'], ownerId: adminId });
		expect((await alertById('w-10')).ownerId).toBe(adminId);
		const viaNull = await post('/api/v1/alerts/custom', custom('w-10', { owner: null }));
		expect(viaNull.status).toBe(200);
		expect(viaNull.body.data.owner).toBe('unassigned');
		expect((await alertById('w-10')).ownerId).toBeNull();
	});

	test('an empty owner on an alert nobody owns is a no-op, still reported as unassigned; absent stays silent', async () => {
		await post('/api/v1/alerts/custom', custom('w-11'));
		const empty = await post('/api/v1/alerts/custom', custom('w-11', { owner: '' }));
		expect(empty.body.data.owner).toBe('unassigned');
		expect((await alertById('w-11')).ownerId).toBeNull();
		expect(await historyOf('w-11')).not.toContain('Owner removed');
		const absent = await post('/api/v1/alerts/custom', custom('w-11'));
		expect(absent.body.data.owner).toBeUndefined();
	});

	test('removing the owner takes the alert out of its incident', async () => {
		await post('/api/v1/alerts/custom', custom('w-12', { owner: 'dana@example.com' }));
		const incident = await app
			.post('/api/v1/incidents')
			.set('Authorization', `Bearer ${jwt}`)
			.send({ name: 'Webhook owner', alertIds: ['w-12'] });
		expect(incident.status).toBe(201);
		expect((await alertById('w-12')).incidentId).not.toBeNull();
		await post('/api/v1/alerts/custom', custom('w-12', { owner: '' }));
		const after = await alertById('w-12');
		expect(after.ownerId).toBeNull();
		expect(after.incidentId ?? null).toBeNull();
	});

	test('an empty owner tag clears too — Grafana labels here', async () => {
		const grafana = (owner: string) => ({
			alerts: [
				{
					status: 'firing',
					fingerprint: 'g-3',
					labels: { alertname: 'CPU', owner },
					annotations: { summary: 'cpu' },
				},
			],
		});
		await post('/api/v1/alerts/custom/grafana', grafana('dana@example.com'));
		expect((await alertById('g-3')).ownerId).not.toBeNull();
		const res = await post('/api/v1/alerts/custom/grafana', grafana(''));
		expect(res.status).toBe(200);
		expect(res.body.data.owners).toEqual({ 'g-3': 'unassigned' });
		expect((await alertById('g-3')).ownerId).toBeNull();
	});

	test('owner decisions for one alert run in arrival order: a slow assignment cannot overtake a later removal', async () => {
		const userRepo = new UserRepository(db);
		const bl = new AlertBL(
			new AlertRepository(db),
			new ResolvedAlertRepository(db),
			new AlertCommentsRepository(db),
			new AlertHistoryRepository(db),
			userRepo
		);
		const dana = await userRepo.getUserByEmail('dana@example.com');
		let release: () => void = () => undefined;
		const directory = new Promise<void>((resolve) => (release = resolve));
		const slow = { lookup: async () => (await directory, { user: dana }) } as unknown as WebhookOwnerResolver;
		bl.setWebhookOwnerResolver(slow);
		const now = new Date().toISOString();
		const incoming = (owner: string): IncomingAlert => ({
			id: 'w-race',
			type: 'Custom',
			status: AlertStatus.FIRING,
			tags: {},
			startsAt: now,
			updatedAt: now,
			alertUrl: '',
			alertName: 'race',
			summary: '',
			owner,
		});
		// The assignment is waiting on the directory when the removal arrives.
		const assign = bl.insertOrUpdateAlert(incoming('dana@example.com'));
		const clear = bl.insertOrUpdateAlert(incoming(''));
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect((await alertById('w-race')).ownerId).toBeNull();
		release();
		expect((await assign).owner).toBe('assigned');
		expect((await clear).owner).toBe('unassigned');
		// Last message wins: the removal applied after the assignment, not before it.
		expect((await alertById('w-race')).ownerId).toBeNull();
		expect(await historyOf('w-race')).toContain('Owner removed');
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

	// Answers for the identifier or any alternative spelling, recording each one searched
	// (as the real client does: one search per spelling, until an entry is found).
	const directory = {
		lookup(typed: string, alternatives: string[] = []): Promise<LdapIdentity | null> {
			const asked = [typed, ...alternatives];
			if (directoryDown) {
				lookups.push(asked[0]);
				return Promise.reject(new LdapUnavailableError('connect ECONNREFUSED'));
			}
			const known = ['dana', 'dana@acme.test', 'guest', 'guest@acme.test', 'noa', 'mia@acme.test'];
			const found = asked.findIndex((s) => known.includes(s));
			lookups.push(...(found < 0 ? asked : asked.slice(0, found + 1)));
			const identifier = found < 0 ? typed : asked[found];
			if (identifier === 'noa') {
				// A directory account with no mail attribute at all.
				return Promise.resolve({
					dn: 'cn=noa,dc=x',
					objectId: 'uuid-noa',
					username: 'noa',
					email: null,
					fullName: 'Noa Nomail',
					groups: [],
					role: Role.Viewer,
				});
			}
			if (identifier === 'mia@acme.test') {
				return Promise.resolve({
					dn: 'cn=mia,dc=x',
					objectId: 'uuid-mia',
					username: 'mia',
					email: 'mia@acme.test',
					fullName: 'Mia',
					groups: [],
					role: Role.Viewer,
				});
			}
			if (identifier === 'dana' || identifier === 'dana@acme.test') {
				return Promise.resolve({
					dn: 'cn=dana,dc=x',
					objectId: 'uuid-dana',
					username: 'dana',
					email: 'dana@acme.test',
					fullName: 'Dana Directory',
					groups: [],
					role: Role.Editor,
				});
			}
			if (identifier === 'guest' || identifier === 'guest@acme.test') {
				return Promise.resolve({
					dn: 'cn=guest,dc=x',
					objectId: 'uuid-guest',
					username: 'guest',
					email: 'guest@acme.test',
					fullName: 'Guest',
					groups: [],
					role: null,
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

	afterAll(() => db.close());

	beforeEach(() => {
		db.exec('DELETE FROM users');
		lookups.length = 0;
		directoryDown = false;
	});

	test('a directory user who never logged in is provisioned (as a first login would) and returned', async () => {
		const resolver = new WebhookOwnerResolver(userBL, () => 'acme.test');
		const user = await resolver.resolve('dana');
		expect(user?.username).toBe('dana');
		expect(user?.email).toBe('dana@acme.test');
		expect(user?.fullName).toBe('Dana Directory');
		expect(user?.role).toBe(Role.Editor);
		expect(user?.authSource).toBe('ldap');
		// Asked by the address now: the account exists, so the directory is not called again.
		expect((await resolver.resolve('Dana@acme.test'))?.id).toBe(user?.id);
		// And by the name within the window: the cache answers.
		expect((await resolver.resolve('DANA'))?.id).toBe(user?.id);
		// The exact name settled it; the completed address was never needed.
		expect(lookups).toEqual(['dana']);
	});

	test('an unknown owner with no mail in the directory is provisioned by username; the account is then found without the directory', async () => {
		// No default login domain: a bare name is asked of the directory as a username only.
		const resolver = new WebhookOwnerResolver(userBL, () => null);
		const user = await resolver.resolve('Noa');
		expect(user).toMatchObject({ username: 'noa', email: null, fullName: 'Noa Nomail', authSource: 'ldap' });
		expect(lookups).toEqual(['noa']);
		// Another resolver (a restart, or the cache cleared after a user change): the row
		// is found by username, the directory is not asked again.
		const again = await new WebhookOwnerResolver(userBL, () => null).resolve('noa');
		expect(again?.id).toBe(user?.id);
		expect(lookups).toEqual(['noa']);
		// An address names a directory user by email, as before; an unknown bare name is
		// asked as a username and nothing else.
		expect((await resolver.resolve('mia@acme.test'))?.username).toBe('mia');
		expect(await resolver.resolve('nobody')).toBeNull();
		expect(lookups).toEqual(['noa', 'mia@acme.test', 'nobody']);
	});

	test('in no mapped group → nobody; unknown → nobody (as a username, then as the completed address); a local account wins without asking the directory', async () => {
		const resolver = new WebhookOwnerResolver(userBL, () => 'acme.test');
		expect(await resolver.resolve('guest')).toBeNull();
		expect(await resolver.resolve('nobody')).toBeNull();
		await userRepo.createUser({
			username: 'local',
			email: null,
			passwordHash: 'hash',
			fullName: 'Local',
			role: Role.Viewer,
		});
		expect((await resolver.resolve('local'))?.username).toBe('local');
		// A found-but-refused entry ends the search; an unknown name goes on to the address.
		expect(lookups).toEqual(['guest', 'nobody', 'nobody@acme.test']);
	});

	test('a local account reached through the completed address is the answer even while the directory is down', async () => {
		await userRepo.createUser({
			username: 'ops',
			email: 'ops-team@acme.test',
			passwordHash: 'hash',
			fullName: 'Ops Team',
			role: Role.Viewer,
		});
		directoryDown = true;
		const resolver = new WebhookOwnerResolver(userBL, () => 'acme.test');
		// No account is named "ops-team"; ops-team@acme.test is a local account: found
		// without asking the directory, which could not have answered anyway.
		expect((await resolver.resolve('ops-team'))?.username).toBe('ops');
		expect(lookups).toEqual([]);
		// Someone the directory would have to answer for: no answer, and said so.
		const asked = await resolver.lookup('dana');
		expect(asked.user).toBeNull();
		expect(asked.failure).toMatch(/directory could not be asked/);
	});

	test('a cached miss is forgotten when the LDAP settings change', async () => {
		const resolver = new WebhookOwnerResolver(userBL, () => null);
		userBL.setOnDirectoryChanged(() => resolver.clear());
		try {
			userBL.setLdapAuthenticator(null);
			expect(await resolver.resolve('dana')).toBeNull();
			// LDAP switched on: the same webhook minutes later finds her in the directory.
			userBL.setLdapAuthenticator(directory, 0);
			expect((await resolver.resolve('dana'))?.username).toBe('dana');
		} finally {
			userBL.setOnDirectoryChanged(() => undefined);
			userBL.setLdapAuthenticator(directory, 0);
		}
	});

	test('a provisioning failure on the way (the database) is not remembered either', async () => {
		const resolver = new WebhookOwnerResolver(userBL, () => null);
		const original = userRepo.createUser.bind(userRepo);
		let failedOnce = false;
		let rejectWith: unknown = new Error('SQLITE_BUSY: database is locked');
		const spy = vi.spyOn(userRepo, 'createUser').mockImplementation(async (row) => {
			if (!failedOnce) {
				failedOnce = true;
				throw rejectWith;
			}
			return original(row);
		});
		// Not a miss: the caller hears why, and nothing is cached.
		const failed = await resolver.lookup('dana');
		expect(failed.user).toBeNull();
		expect(failed.failure).toMatch(/provisioning failed: SQLITE_BUSY/);
		expect((await resolver.resolve('dana'))?.username).toBe('dana');
		// A rejection that is not an Error is reported too, not thrown again.
		db.exec('DELETE FROM users');
		resolver.clear();
		failedOnce = false;
		rejectWith = undefined;
		expect((await resolver.lookup('dana')).failure).toMatch(/provisioning failed: undefined/);
		expect((await resolver.resolve('dana'))?.username).toBe('dana');
		spy.mockRestore();
	});

	test('a directory that is down means no owner, not an error — and is not remembered: the same resolver asks again', async () => {
		directoryDown = true;
		const resolver = new WebhookOwnerResolver(userBL, () => 'acme.test');
		await expect(resolver.resolve('dana')).resolves.toBeNull();
		directoryDown = false;
		// Within the cache window, with the same resolver: the outage was no answer.
		expect((await resolver.resolve('dana'))?.username).toBe('dana');
		const noDomain = new WebhookOwnerResolver(userBL, () => null);
		expect((await noDomain.resolve('dana'))?.username).toBe('dana');
		expect(lookups).toEqual(['dana', 'dana']);
	});
});
