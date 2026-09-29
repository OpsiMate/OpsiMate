import Database from 'better-sqlite3';
import { SuperTest, Test } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup.ts';

interface LdapConfigDbRow {
	settings: string;
	bind_password: string | null;
}

interface AuditDbRow {
	details: string;
}

const COMPLETE = {
	url: 'ldaps://ldap.example.com',
	bindDn: 'cn=svc,dc=example,dc=com',
	bindPassword: 'svc-secret-value',
	searchBase: 'ou=people,dc=example,dc=com',
	roleMapping: { admin: ['cn=ops-admins,ou=groups,dc=example,dc=com'], editor: ['sre'], operation: [], viewer: [] },
};

describe('LDAP settings API', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let token: string;

	const put = (body: object) => app.put('/api/v1/ldap/settings').set('Authorization', `Bearer ${token}`).send(body);
	const get = () => app.get('/api/v1/ldap/settings').set('Authorization', `Bearer ${token}`);

	beforeAll(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		token = await setupUserWithToken(app);
	});

	beforeEach(() => {
		db.exec('DELETE FROM ldap_config');
	});

	afterAll(() => db.close());

	test('starts empty and editable, with defaults filled in', async () => {
		const res = await get();
		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({
			source: 'database',
			enabled: false,
			url: '',
			hasBindPassword: false,
			searchFilter: '(mail={{email}})',
			emailAttribute: 'mail',
			groupsAttribute: 'memberOf',
			loginMaxFailures: 5,
			tlsRejectUnauthorized: true,
			defaultRole: null,
		});
	});

	test('enabling incomplete settings is refused with what is missing; nothing is saved', async () => {
		const res = await put({ enabled: true, url: 'ldaps://ldap.example.com' });
		expect(res.status).toBe(400);
		expect(res.body.details).toEqual(expect.arrayContaining(['search_base']));
		expect((await get()).body.data.enabled).toBe(false);
		expect((await get()).body.data.url).toBe('');
	});

	test('saves, enables, and never returns or stores the password in clear', async () => {
		const res = await put({ ...COMPLETE, enabled: true });
		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ enabled: true, hasBindPassword: true, url: COMPLETE.url });
		expect(JSON.stringify(res.body)).not.toContain('svc-secret-value');
		expect(JSON.stringify((await get()).body)).not.toContain('svc-secret-value');

		const row = db.prepare('SELECT settings, bind_password FROM ldap_config').get() as LdapConfigDbRow;
		expect(row.settings).not.toContain('svc-secret-value');
		expect(row.bind_password).toBeTruthy();
		expect(row.bind_password).not.toContain('svc-secret-value');

		const audit = db.prepare(`SELECT details FROM audit_logs WHERE resource_type = 'LDAP'`).all() as AuditDbRow[];
		expect(audit.length).toBeGreaterThan(0);
		expect(audit.map((a) => a.details).join(' ')).not.toContain('svc-secret-value');
	});

	test('password: omitted keeps it, null removes it (and then a bind DN can no longer be enabled)', async () => {
		await put({ ...COMPLETE, enabled: true });
		expect((await put({ nameAttribute: 'cn' })).body.data.hasBindPassword).toBe(true);
		const removed = await put({ enabled: false, bindPassword: null });
		expect(removed.body.data.hasBindPassword).toBe(false);
		const reenable = await put({ enabled: true });
		expect(reenable.status).toBe(400);
		expect(reenable.body.details.join(' ')).toMatch(/bind_password/);
	});

	test('an edit that would break an enabled config is refused', async () => {
		await put({ ...COMPLETE, enabled: true });
		const res = await put({ searchBase: '' });
		expect(res.status).toBe(400);
		expect((await get()).body.data.searchBase).toBe(COMPLETE.searchBase);
	});

	test('shape validation: bad URL, filter without placeholder, non-PEM CA', async () => {
		expect((await put({ url: 'http://x' })).status).toBe(400);
		expect((await put({ searchFilter: '(mail=foo)' })).status).toBe(400);
		expect((await put({ tlsCaCert: 'not a cert' })).status).toBe(400);
		expect((await put({ loginMaxFailures: -1 })).status).toBe(400);
		expect((await put({ unknownField: true })).status).toBe(400);
	});

	test('test connection before anything is saved says what to do', async () => {
		const res = await app.post('/api/v1/ldap/test').set('Authorization', `Bearer ${token}`).send({});
		expect(res.status).toBe(200);
		expect(res.body.data.ok).toBe(false);
		expect(res.body.data.steps[0].message).toMatch(/Save a server URL/);
	});

	test('test connection to an unreachable server fails at the connect step', async () => {
		await put({ ...COMPLETE, url: 'ldap://127.0.0.1:1', timeoutMs: 1000 });
		const res = await app.post('/api/v1/ldap/test').set('Authorization', `Bearer ${token}`).send({});
		expect(res.body.data.ok).toBe(false);
		expect(res.body.data.steps[0]).toMatchObject({ step: 'connect', ok: false });
	});

	test('if the audit row cannot be written, the change is not saved or applied (one transaction)', async () => {
		db.exec('ALTER TABLE audit_logs RENAME TO audit_logs_hidden');
		try {
			const res = await put({ ...COMPLETE, enabled: true });
			expect(res.status).toBe(500);
		} finally {
			db.exec('ALTER TABLE audit_logs_hidden RENAME TO audit_logs');
		}
		const after = (await get()).body.data;
		expect(after).toMatchObject({ enabled: false, url: '', hasBindPassword: false });
	});

	test('a stored password that no longer decrypts counts as none (never bind with ciphertext)', async () => {
		await put({ ...COMPLETE, enabled: false });
		db.prepare('UPDATE ldap_config SET bind_password = ?').run(
			'bm90LWEtcmVhbC1jaXBoZXJ0ZXh0LWF0LWFsbC4uLi4uLi4uLi4uLi4uLi4uLi4uLg=='
		);
		expect((await get()).body.data.hasBindPassword).toBe(false);
		const enable = await put({ enabled: true });
		expect(enable.status).toBe(400);
		expect(enable.body.details.join(' ')).toMatch(/bind_password/);
	});

	test('changing where or how the stored password is sent requires re-entering it', async () => {
		await put({ ...COMPLETE, enabled: false });
		for (const change of [
			{ url: 'ldap://attacker.example.com:389' },
			{ bindDn: 'cn=other,dc=example,dc=com' },
			{ startTls: true },
			{ tlsRejectUnauthorized: false },
			{ tlsCaCert: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----' },
		]) {
			const refused = await put(change);
			expect(refused.status).toBe(400);
			expect(refused.body.details.join(' ')).toMatch(/re-enter the service-account password/);
		}
		expect((await get()).body.data.url).toBe(COMPLETE.url);
		// With the password, the same change goes through.
		const ok = await put({ url: 'ldaps://ldap2.example.com', bindPassword: 'svc-secret-value' });
		expect(ok.status).toBe(200);
		expect(ok.body.data.url).toBe('ldaps://ldap2.example.com');
		// Unrelated fields never need it.
		expect((await put({ searchFilter: '(uid={{email}})' })).status).toBe(200);
	});

	test('switched on but unusable is reported as not in effect', async () => {
		await put({ ...COMPLETE, enabled: true });
		expect((await get()).body.data).toMatchObject({ enabled: true, problems: [] });
		db.prepare('UPDATE ldap_config SET bind_password = ?').run(
			'Z2FyYmFnZS1jaXBoZXJ0ZXh0LWdhcmJhZ2UtY2lwaGVydGV4dC4uLi4uLi4uLi4uLg=='
		);
		const data = (await get()).body.data;
		expect(data.enabled).toBe(true);
		expect(data.problems.join(' ')).toMatch(/bind_password/);
	});

	test('the audit row names the changed settings (never values of the password)', async () => {
		await put({ ...COMPLETE, enabled: false });
		await put({
			roleMapping: { ...COMPLETE.roleMapping, admin: ['cn=new-admins,dc=example,dc=com'] },
			defaultRole: 'viewer',
		});
		const last = db
			.prepare(`SELECT details FROM audit_logs WHERE resource_type = 'LDAP' ORDER BY id DESC LIMIT 1`)
			.get() as AuditDbRow;
		expect(last.details).toMatch(/changed: default_role, role_mapping/);
		expect(last.details).not.toContain('svc-secret-value');
	});
});
