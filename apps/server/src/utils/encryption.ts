import * as crypto from 'crypto';
import { Logger } from '@OpsiMate/shared';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

const logger = new Logger('encryption-');

/**
 * Get encryption key from environment variable or use default
 */
function getEncryptionKey(): string {
	return process.env.ENCRYPTION_KEY || 'test-key-should-be-changed';
}

/**
 * Derive a key from the master key using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
	return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt a password string
 */
export function encryptPassword(password: string | undefined): string | undefined {
	if (!password) {
		return password;
	}

	const masterKey = getEncryptionKey();
	const salt = crypto.randomBytes(SALT_LENGTH);
	const iv = crypto.randomBytes(IV_LENGTH);
	const key = deriveKey(masterKey, salt);

	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(password, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	const authTag = cipher.getAuthTag();

	// Combine salt + iv + authTag + encrypted data
	const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);

	return combined.toString('base64');
}

/**
 * Decrypt a password string
 */
export function decryptPassword(encryptedPassword: string | undefined): string | undefined {
	if (!encryptedPassword) {
		return encryptedPassword;
	}

	try {
		const masterKey = getEncryptionKey();
		const combined = Buffer.from(encryptedPassword, 'base64');

		// Extract components
		const salt = combined.subarray(0, SALT_LENGTH);
		const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
		const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
		const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

		const key = deriveKey(masterKey, salt);

		const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encrypted, undefined, 'utf8');
		decrypted += decipher.final('utf8');

		return decrypted;
	} catch (error) {
		logger.error('Failed to decrypt password:', error);
		// Return the original value if decryption fails (for backward compatibility)
		return encryptedPassword;
	}
}

/**
 * Hash a string using SHA-512
 */
export function hashString(token: string): string {
	return crypto.createHash('sha512').update(token).digest('hex');
}

/**
 * Generate a secure random token and its hash for password reset
 * Returns the token, its hash, expiration time, and reset URL
 * The token is valid for 15 minutes
 * The reset URL is constructed using the APP_BASE_URL environment variable
 * The token hash is generated using SHA-512
 * The reset URL is in the format: `${APP_BASE_URL}/reset-password?token=${token}`
 */
export function generatePasswordResetInfo(): {
	encryptedToken: string;
	tokenHash: string;
	expiresAt: Date;
} {
	const token = crypto.randomBytes(32).toString('hex');
	const encryptedToken = encryptPassword(token)!;
	const tokenHash = hashString(token);
	const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
	return { encryptedToken, tokenHash, expiresAt };
}
