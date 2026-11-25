import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
	encryptPassword,
	decryptPassword,
	ENCRYPTION_KEY_FILE,
	reencryptLegacyValue,
	resolveEncryptionKey,
	warnIfEncryptionKeyInsecure,
	generatePasswordResetInfo,
	PASSWORD_RESET_TTL_MINUTES,
} from '../src/utils/encryption';
import { passwordResetTemplate } from '../src/utils/mailTemplate';

describe('Password Encryption', () => {
	test('should encrypt and decrypt password correctly', () => {
		const originalPassword = 'mySecretPassword123!';

		// Encrypt the password
		const encrypted = encryptPassword(originalPassword);
		expect(encrypted).toBeDefined();
		expect(encrypted).not.toBe(originalPassword);
		expect(encrypted).not.toContain(originalPassword);

		// Decrypt the password
		const decrypted = decryptPassword(encrypted);
		expect(decrypted).toBe(originalPassword);
	});

	test('should handle undefined passwords', () => {
		expect(encryptPassword(undefined)).toBeUndefined();
		expect(decryptPassword(undefined)).toBeUndefined();
	});

	test('should handle empty passwords', () => {
		expect(encryptPassword('')).toBe('');
		expect(decryptPassword('')).toBe('');
	});

	test('should produce different encrypted values for same password', () => {
		const password = 'testPassword';
		const encrypted1 = encryptPassword(password);
		const encrypted2 = encryptPassword(password);

		expect(encrypted1).not.toBe(encrypted2);
		expect(decryptPassword(encrypted1)).toBe(password);
		expect(decryptPassword(encrypted2)).toBe(password);
	});

	test('should handle decryption failure gracefully', () => {
		const invalidEncrypted = 'invalidBase64String';
		const result = decryptPassword(invalidEncrypted);
		// Should return the original value if decryption fails
		expect(result).toBe(invalidEncrypted);
	});

	// The key invariant: warning must NEVER throw, so it can't block a boot. Env is
	// injected, so this never mutates the shared process.env (which would leak into
	// other test files in the same worker).
	test('warnIfEncryptionKeyInsecure never throws, in any environment', () => {
		expect(() => warnIfEncryptionKeyInsecure({ NODE_ENV: 'production' })).not.toThrow();
		expect(() => warnIfEncryptionKeyInsecure({ NODE_ENV: 'production', ENCRYPTION_KEY: '   ' })).not.toThrow();
		expect(() =>
			warnIfEncryptionKeyInsecure({ NODE_ENV: 'production', ENCRYPTION_KEY: 'test-key-should-be-changed' })
		).not.toThrow();
		expect(() =>
			warnIfEncryptionKeyInsecure({ NODE_ENV: 'production', ENCRYPTION_KEY: 'a-strong-secret' })
		).not.toThrow();
		expect(() => warnIfEncryptionKeyInsecure({ NODE_ENV: 'development' })).not.toThrow();
	});
});

describe('Password reset link lifetime', () => {
	test('generatePasswordResetInfo expires PASSWORD_RESET_TTL_MINUTES after now', () => {
		vi.useFakeTimers();
		try {
			const now = new Date('2026-01-01T00:00:00Z');
			vi.setSystemTime(now);

			const { expiresAt } = generatePasswordResetInfo();

			expect(expiresAt.getTime() - now.getTime()).toBe(PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
		} finally {
			vi.useRealTimers();
		}
	});

	test('the reset email states the same lifetime', () => {
		expect(passwordResetTemplate('https://x')).toContain(`${PASSWORD_RESET_TTL_MINUTES} minutes`);
	});
});

// The stored format, written out independently of the module: salt (64) + iv (16) + GCM
// tag (16) + ciphertext, base64, key from PBKDF2-SHA512 (100k rounds). Building values this
// way proves that what an older OpsiMate stored is still read.
const LEGACY_PUBLIC_KEY = 'test-key-should-be-changed';
const encryptUnder = (masterKey: string, plaintext: string): string => {
	const salt = crypto.randomBytes(64);
	const iv = crypto.randomBytes(16);
	const key = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha512');
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	return Buffer.concat([salt, iv, cipher.getAuthTag(), body]).toString('base64');
};
const decryptsUnder = (masterKey: string, value: string): boolean => {
	const raw = Buffer.from(value, 'base64');
	const key = crypto.pbkdf2Sync(masterKey, raw.subarray(0, 64), 100000, 32, 'sha512');
	const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(64, 80));
	decipher.setAuthTag(raw.subarray(80, 96));
	try {
		decipher.update(raw.subarray(96));
		decipher.final();
		return true;
	} catch {
		return false;
	}
};

describe('credentials saved under the old public key', () => {
	test('are still read', () => {
		const legacy = encryptUnder(LEGACY_PUBLIC_KEY, 'ldap-bind-password');
		expect(decryptPassword(legacy)).toBe('ldap-bind-password');
	});

	test('reencryptLegacyValue moves them to the current key, leaving the plaintext unchanged', () => {
		const legacy = encryptUnder(LEGACY_PUBLIC_KEY, 'sk-ai-api-key');
		const moved = reencryptLegacyValue(legacy);
		expect(moved).not.toBeNull();
		expect(moved).not.toBe(legacy);
		expect(decryptsUnder(LEGACY_PUBLIC_KEY, moved as string)).toBe(false);
		expect(decryptsUnder(process.env.ENCRYPTION_KEY as string, moved as string)).toBe(true);
		expect(decryptPassword(moved as string)).toBe('sk-ai-api-key');
		// Once moved there is nothing left to move.
		expect(reencryptLegacyValue(moved)).toBeNull();
	});

	test('nothing to move: values under the current key, plaintext, garbage, empty', () => {
		expect(reencryptLegacyValue(encryptPassword('already-current'))).toBeNull();
		expect(reencryptLegacyValue('stored-before-encryption-existed')).toBeNull();
		expect(reencryptLegacyValue(encryptUnder('some-other-key', 'x'))).toBeNull();
		expect(reencryptLegacyValue('')).toBeNull();
		expect(reencryptLegacyValue(null)).toBeNull();
	});
});

describe('resolveEncryptionKey', () => {
	let dir: string;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-enc-'));
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test('a set ENCRYPTION_KEY is used verbatim, as always, and nothing is written', () => {
		expect(resolveEncryptionKey({ ENCRYPTION_KEY: '  spaced  ' }, dir)).toEqual({
			key: '  spaced  ',
			source: 'env',
		});
		expect(fs.readdirSync(dir)).toEqual([]);
	});

	test.each([
		['unset', {}],
		['empty', { ENCRYPTION_KEY: '' }],
	])('%s: the install generates its own key once, next to the database, and keeps it', (_case, env) => {
		const first = resolveEncryptionKey(env, dir);
		expect(first).toMatchObject({ source: 'generated', file: path.join(dir, ENCRYPTION_KEY_FILE) });
		expect(first.key).toMatch(/^[0-9a-f]{64}$/);
		expect(first.key).not.toBe(LEGACY_PUBLIC_KEY);
		expect(resolveEncryptionKey(env, dir)).toEqual({ ...first, source: 'file' });
	});
});
