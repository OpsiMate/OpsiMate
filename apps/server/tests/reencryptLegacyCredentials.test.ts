import * as crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { reencryptLegacyCredentials } from '../src/dal/reencryptLegacyCredentials';
import { decryptPassword, encryptPassword, reencryptLegacyValue } from '../src/utils/encryption';

// An upgrade from an install that never set ENCRYPTION_KEY: its stored credentials were
// encrypted with the public built-in key, and the server moves them to the install's own
// key in the background, one value at a time, without changing what they decrypt to.

const LEGACY_PUBLIC_KEY = 'test-key-should-be-changed';
const encryptUnder = (masterKey: string, plaintext: string): string => {
	const salt = crypto.randomBytes(64);
	const iv = crypto.randomBytes(16);
	const key = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha512');
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	return Buffer.concat([salt, iv, cipher.getAuthTag(), body]).toString('base64');
};

interface ValueRow {
	value: string | null;
}

const noPause = (): Promise<void> => Promise.resolve();

describe('reencryptLegacyCredentials', () => {
	let db: Database.Database;
	const value = (sql: string): string | null => (db.prepare(sql).get() as ValueRow).value;
	const integration = (name: string) =>
		value(`SELECT credentials AS value FROM integrations WHERE name = '${name}'`) as string;

	beforeEach(() => {
		db = new Database(':memory:');
		db.exec(`
			CREATE TABLE ldap_config (id INTEGER PRIMARY KEY CHECK (id = 1), settings TEXT, bind_password TEXT);
			CREATE TABLE ai_config (id INTEGER PRIMARY KEY CHECK (id = 1), api_key TEXT);
			CREATE TABLE integrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, credentials JSON NOT NULL);
		`);
	});

	afterEach(() => db.close());

	const seedLegacy = () => {
		db.prepare('INSERT INTO ldap_config (id, settings, bind_password) VALUES (1, ?, ?)').run(
			'{}',
			encryptUnder(LEGACY_PUBLIC_KEY, 'bind-pw')
		);
		db.prepare('INSERT INTO ai_config (id, api_key) VALUES (1, ?)').run(encryptUnder(LEGACY_PUBLIC_KEY, 'sk-1'));
		db.prepare('INSERT INTO integrations (name, credentials) VALUES (?, ?)').run(
			'grafana',
			encryptUnder(LEGACY_PUBLIC_KEY, '{"apiKey":"g"}')
		);
	};

	test('moves every value still under the public key, and only those', async () => {
		seedLegacy();
		const currentCredentials = encryptPassword('{"token":"already-current"}') as string;
		db.prepare('INSERT INTO integrations (name, credentials) VALUES (?, ?)').run('zabbix', currentCredentials);

		expect(await reencryptLegacyCredentials(db, noPause)).toEqual({
			moved: { ldap_config: 1, ai_config: 1, integrations: 1 },
			failed: {},
		});

		const bind = value('SELECT bind_password AS value FROM ldap_config') as string;
		const apiKey = value('SELECT api_key AS value FROM ai_config') as string;
		expect(decryptPassword(bind)).toBe('bind-pw');
		expect(decryptPassword(apiKey)).toBe('sk-1');
		expect(decryptPassword(integration('grafana'))).toBe('{"apiKey":"g"}');
		for (const moved of [bind, apiKey, integration('grafana')]) expect(reencryptLegacyValue(moved)).toBeNull();
		// Already under the current key: untouched, byte for byte.
		expect(integration('zabbix')).toBe(currentCredentials);

		// A second start has nothing to do.
		expect(await reencryptLegacyCredentials(db, noPause)).toEqual({ moved: {}, failed: {} });
	});

	test('a value whose write fails is left as it was, the rest still move, and the next start finishes it', async () => {
		seedLegacy();
		const legacyGrafana = integration('grafana');
		// The integrations write is refused this time (a locked table, a full disk...).
		db.exec(`CREATE TRIGGER refuse BEFORE UPDATE ON integrations BEGIN SELECT RAISE(ABORT, 'disk full'); END;`);

		expect(await reencryptLegacyCredentials(db, noPause)).toEqual({
			moved: { ldap_config: 1, ai_config: 1 },
			failed: { integrations: 1 },
		});
		expect(integration('grafana')).toBe(legacyGrafana);
		// Still readable in the meantime, through the old-key fallback.
		expect(decryptPassword(legacyGrafana)).toBe('{"apiKey":"g"}');

		db.exec('DROP TRIGGER refuse');
		expect(await reencryptLegacyCredentials(db, noPause)).toEqual({ moved: { integrations: 1 }, failed: {} });
		expect(reencryptLegacyValue(integration('grafana'))).toBeNull();
		expect(decryptPassword(integration('grafana'))).toBe('{"apiKey":"g"}');
	});

	test('a credential an admin saves while it runs is never overwritten', async () => {
		seedLegacy();
		const savedMeanwhile = encryptPassword('new-bind-pw') as string;
		// The admin's save lands between reading the row and writing it back.
		let pauses = 0;
		const adminSavesDuringFirstPause = () => {
			if (pauses++ === 0) {
				db.prepare('UPDATE ldap_config SET bind_password = ? WHERE id = 1').run(savedMeanwhile);
			}
			return Promise.resolve();
		};
		const result = await reencryptLegacyCredentials(db, adminSavesDuringFirstPause);
		expect(result.moved.ldap_config).toBeUndefined();
		expect(value('SELECT bind_password AS value FROM ldap_config')).toBe(savedMeanwhile);
		expect(result.moved).toMatchObject({ ai_config: 1, integrations: 1 });
	});

	test('yields to the event loop before each value', async () => {
		seedLegacy();
		let pauses = 0;
		await reencryptLegacyCredentials(db, () => {
			pauses++;
			return Promise.resolve();
		});
		expect(pauses).toBe(3);
	});

	test('empty tables, NULL columns and missing tables are fine', async () => {
		db.prepare('INSERT INTO ldap_config (id, settings, bind_password) VALUES (1, ?, NULL)').run('{}');
		db.exec('DROP TABLE ai_config');
		expect(await reencryptLegacyCredentials(db, noPause)).toEqual({ moved: {}, failed: {} });
	});
});
