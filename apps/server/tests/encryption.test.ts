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

	test('passes legacy plaintext (not our ciphertext shape) through unchanged', () => {
		// These were never produced by encryptPassword — the backward-compat path.
		expect(decryptPassword('invalidBase64String')).toBe('invalidBase64String');
		expect(decryptPassword('{"user":"admin","pass":"hunter2"}')).toBe('{"user":"admin","pass":"hunter2"}');
	});

	test('throws when a value shaped like our ciphertext cannot be decrypted', () => {
		// Corrupt one byte of a real ciphertext so GCM auth fails but the shape stays.
		const encrypted = encryptPassword('a-real-secret')!;
		const buffer = Buffer.from(encrypted, 'base64');
		buffer[buffer.length - 1] ^= 0xff;
		const tampered = buffer.toString('base64');
		expect(() => decryptPassword(tampered)).toThrow(DecryptionError);
	});

	// Env injected, never mutating the shared process.env, so these can't leak into
	// test files running in the same worker.
	test('assertEncryptionKeyConfigured refuses a production boot with no key', () => {
		expect(() => assertEncryptionKeyConfigured({ NODE_ENV: 'production' })).toThrow(/ENCRYPTION_KEY/);
		expect(() =>
			assertEncryptionKeyConfigured({ NODE_ENV: 'production', ENCRYPTION_KEY: 'a-strong-private-secret' })
		).not.toThrow();
	});

	test('assertEncryptionKeyConfigured is a no-op outside production', () => {
		expect(() => assertEncryptionKeyConfigured({ NODE_ENV: 'test' })).not.toThrow();
		expect(() => assertEncryptionKeyConfigured({ NODE_ENV: 'development' })).not.toThrow();
	});
});
