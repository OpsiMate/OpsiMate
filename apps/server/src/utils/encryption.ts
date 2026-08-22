import * as crypto from 'crypto';
import { Logger } from '@OpsiMate/shared';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Provenance marker prepended to everything we encrypt. Its presence means "this value
// was produced by encryptPassword", so a decryption failure on it is a real problem
// (changed key / corruption) rather than possibly-legacy-plaintext. It removes the need
// to GUESS provenance from a value's shape.
const CIPHERTEXT_PREFIX = 'gcm1:';

const logger = new Logger('encryption-');

// The built-in key is a PUBLIC constant (it ships in this repo). It exists so local
// dev and the test suite work with zero config — it must never protect real data.
const DEV_FALLBACK_KEY = 'test-key-should-be-changed';

// Raised when a value shaped exactly like our ciphertext cannot be decrypted — almost
// always a changed ENCRYPTION_KEY or corrupted storage. Distinct type so callers can
// tell "this secret is unreadable" apart from any other failure.
export class DecryptionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DecryptionError';
	}
}

/**
 * Get encryption key from environment variable or use default
 */
function getEncryptionKey(): string {
	return process.env.ENCRYPTION_KEY || DEV_FALLBACK_KEY;
}

/**
 * Call once at server boot. In production an unset ENCRYPTION_KEY means every stored
 * credential is encrypted under the public fallback constant — that is not encryption,
 * so refuse to start rather than offer false protection. Dev/test keep the fallback.
 * Setting ENCRYPTION_KEY to ANY value satisfies the check, including the old fallback
 * string, which is the migration path for data already encrypted under it.
 */
export function assertEncryptionKeyConfigured(env: NodeJS.ProcessEnv = process.env): void {
	if (env.NODE_ENV !== 'production') return;
	const key = env.ENCRYPTION_KEY;
	// Whitespace-only counts as unset: getEncryptionKey would otherwise use " " as a
	// trivially guessable master key.
	if (!key || key.trim().length === 0) {
		throw new Error(
			'ENCRYPTION_KEY is not set. OpsiMate encrypts stored credentials with it and refuses ' +
				'to start in production using the built-in fallback key (which is public). Set ' +
				'ENCRYPTION_KEY to a strong secret — or, to keep data already encrypted under the old ' +
				'default, to that previous value.'
		);
	}
	if (key === DEV_FALLBACK_KEY) {
		logger.warn('ENCRYPTION_KEY is set to the public fallback value — rotate it to a private secret.');
	}
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

	return CIPHERTEXT_PREFIX + combined.toString('base64');
}

// Decrypt a bare (unprefixed) base64 blob. Throws on any structural or auth failure.
function decryptBlob(blob: string): string {
	const masterKey = getEncryptionKey();
	const combined = Buffer.from(blob, 'base64');

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
}

// A pre-prefix (legacy-format) ciphertext: strict base64 of at least salt+iv+tag+data.
// Only consulted for UNPREFIXED values, where we cannot be certain of provenance and so
// never throw — a false positive here just means a failed decrypt returns the value
// unchanged, exactly the long-standing backward-compatibility behavior.
const MIN_CIPHERTEXT_BYTES = SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1;
function looksLikeLegacyCiphertext(value: string): boolean {
	if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
		return false;
	}
	return Buffer.from(value, 'base64').length >= MIN_CIPHERTEXT_BYTES;
}

/**
 * Decrypt a password string
 */
export function decryptPassword(encryptedPassword: string | undefined): string | undefined {
	if (!encryptedPassword) {
		return encryptedPassword;
	}

	// Prefixed: unambiguously ours. A failure here is a changed ENCRYPTION_KEY or
	// corruption — surface it rather than silently hand a broken secret downstream
	// (a caller would otherwise use base64 garbage as a live credential).
	if (encryptedPassword.startsWith(CIPHERTEXT_PREFIX)) {
		try {
			return decryptBlob(encryptedPassword.slice(CIPHERTEXT_PREFIX.length));
		} catch (error) {
			logger.error('Failed to decrypt a stored secret (ENCRYPTION_KEY changed or data corrupted):', error);
			throw new DecryptionError('Failed to decrypt a stored secret; ENCRYPTION_KEY may have changed.');
		}
	}

	// Unprefixed: legacy plaintext, OR ciphertext written before the provenance prefix
	// existed. Provenance is unknowable, so NEVER throw. Try to decrypt values shaped
	// like the old ciphertext; on any failure return the value unchanged (this is why a
	// legacy plaintext value — even a long, base64-looking one — is always preserved).
	if (looksLikeLegacyCiphertext(encryptedPassword)) {
		try {
			return decryptBlob(encryptedPassword);
		} catch {
			return encryptedPassword;
		}
	}
	return encryptedPassword;
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
