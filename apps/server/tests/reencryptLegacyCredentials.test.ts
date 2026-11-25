import * as crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { reencryptLegacyCredentials } from '../src/dal/reencryptLegacyCredentials';
import { decryptPassword, encryptPassword, reencryptLegacyValue } from '../src/utils/encryption';

// An upgrade from an install that never set ENCRYPTION_KEY: its stored credentials were
// encrypted with the public built-in key, and the first start moves them to the install's
// own key, in place, without changing what they decrypt to.

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

describe('reencryptLegacyCredentials', () => {
	let db: Database.Database;
	const value = (sql: string): string | null => (db.prepare(sql).get() as ValueRow).value;

	beforeEach(() => {
		db = new Database(':memory:');
		db.exec(`
			CREATE TABLE ldap_config (id INTEGER PRIMARY KEY CHECK (id = 1), settings TEXT, bind_password TEXT);
			CREATE TABLE ai_config (id INTEGER PRIMARY KEY CHECK (id = 1), api_key TEXT);
			CREATE TABLE integrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, credentials JSON NOT NULL);
		`);
	});

	afterEach(() => db.close());

	test('moves every value still under the public key, and only those', () => {
		const currentCredentials = encryptPassword('{"token":"already-current"}') as string;
		db.prepare('INSERT INTO ldap_config (id, settings, bind_password) VALUES (1, ?, ?)').run(
			'{}',
			encryptUnder(LEGACY_PUBLIC_KEY, 'bind-pw')
		);
		db.prepare('INSERT INTO ai_config (id, api_key) VALUES (1, ?)').run(encryptUnder(LEGACY_PUBLIC_KEY, 'sk-1'));
		db.prepare('INSERT INTO integrations (name, credentials) VALUES (?, ?), (?, ?)').run(
			'grafana',
			encryptUnder(LEGACY_PUBLIC_KEY, '{"apiKey":"g"}'),
			'zabbix',
			currentCredentials
		);

		expect(reencryptLegacyCredentials(db)).toEqual({ ldap_config: 1, ai_config: 1, integrations: 1 });

		const bind = value('SELECT bind_password AS value FROM ldap_config') as string;
		const apiKey = value('SELECT api_key AS value FROM ai_config') as string;
		const grafana = value("SELECT credentials AS value FROM integrations WHERE name = 'grafana'") as string;
		expect(decryptPassword(bind)).toBe('bind-pw');
		expect(decryptPassword(apiKey)).toBe('sk-1');
		expect(decryptPassword(grafana)).toBe('{"apiKey":"g"}');
		for (const moved of [bind, apiKey, grafana]) expect(reencryptLegacyValue(moved)).toBeNull();
		// Already under the current key: untouched, byte for byte.
		expect(value("SELECT credentials AS value FROM integrations WHERE name = 'zabbix'")).toBe(currentCredentials);

		// A second start has nothing to do.
		expect(reencryptLegacyCredentials(db)).toEqual({});
	});

	test('empty tables, NULL columns and missing tables are fine', () => {
		db.prepare('INSERT INTO ldap_config (id, settings, bind_password) VALUES (1, ?, NULL)').run('{}');
		db.exec('DROP TABLE ai_config');
		expect(reencryptLegacyCredentials(db)).toEqual({});
	});
});
