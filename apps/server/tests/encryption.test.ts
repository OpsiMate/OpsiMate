import {
	encryptPassword,
	decryptPassword,
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
