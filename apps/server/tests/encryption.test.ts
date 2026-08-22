import {
	assertEncryptionKeyConfigured,
	DecryptionError,
	decryptPassword,
	encryptPassword,
} from '../src/utils/encryption';

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

	test('passes legacy plaintext (unprefixed) through unchanged, even when base64-shaped', () => {
		// Never produced by encryptPassword (no provenance prefix) — the backward-compat
		// path must never throw, whatever the value looks like.
		expect(decryptPassword('invalidBase64String')).toBe('invalidBase64String');
		expect(decryptPassword('{"user":"admin","pass":"hunter2"}')).toBe('{"user":"admin","pass":"hunter2"}');
		// A long, strict-base64 legacy plaintext (>= a ciphertext's minimum length): it
		// is NOT prefixed, so it decodes-and-fails-quietly and is returned unchanged
		// rather than misclassified as our ciphertext and thrown on.
		const longBase64Plaintext = 'A'.repeat(200);
		expect(decryptPassword(longBase64Plaintext)).toBe(longBase64Plaintext);
	});

	test('prefixed ciphertext round-trips, and throws if it cannot be decrypted', () => {
		const encrypted = encryptPassword('a-real-secret')!;
		expect(encrypted.startsWith('gcm1:')).toBe(true);
		expect(decryptPassword(encrypted)).toBe('a-real-secret');

		// Corrupt one byte of the blob (keeping the prefix) so GCM auth fails: because
		// the value is provably ours, this must throw rather than pass garbage through.
		const buffer = Buffer.from(encrypted.slice('gcm1:'.length), 'base64');
		buffer[buffer.length - 1] ^= 0xff;
		const tampered = `gcm1:${buffer.toString('base64')}`;
		expect(() => decryptPassword(tampered)).toThrow(DecryptionError);
	});

	// Env injected, never mutating the shared process.env, so these can't leak into
	// test files running in the same worker.
	test('assertEncryptionKeyConfigured refuses a production boot with no (or blank) key', () => {
		expect(() => assertEncryptionKeyConfigured({ NODE_ENV: 'production' })).toThrow(/ENCRYPTION_KEY/);
		// Whitespace-only is treated as unset — it must not satisfy the check.
		expect(() => assertEncryptionKeyConfigured({ NODE_ENV: 'production', ENCRYPTION_KEY: '   ' })).toThrow(
			/ENCRYPTION_KEY/
		);
		expect(() =>
			assertEncryptionKeyConfigured({ NODE_ENV: 'production', ENCRYPTION_KEY: 'a-strong-private-secret' })
		).not.toThrow();
	});

	test('assertEncryptionKeyConfigured is a no-op outside production', () => {
		expect(() => assertEncryptionKeyConfigured({ NODE_ENV: 'test' })).not.toThrow();
		expect(() => assertEncryptionKeyConfigured({ NODE_ENV: 'development' })).not.toThrow();
	});
});
