import * as crypto from 'crypto';
import { Logger } from '@OpsiMate/shared';
import { instanceSecretsDir } from '../dal/db';
import { readInstanceSecretIfPresent, readOrCreateInstanceSecret } from './instanceSecret';
import { MS_PER_MINUTE } from './time';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

const logger = new Logger('utils/encryption');

// The key every install used before installs generated their own. It is PUBLIC (it ships in
// this repo), so nothing is ever encrypted with it any more; it is kept only to read what was,
// until reencryptLegacyValue moves those values to the install's own key.
const LEGACY_PUBLIC_KEY = 'test-key-should-be-changed';
export const ENCRYPTION_KEY_FILE = 'encryption-key';

export interface ResolvedEncryptionKey {
	key: string;
	source: 'env' | 'generated' | 'file';
	file?: string;
	// Keys that only READ: what earlier values may still be under, moved to `key` by
	// reencryptLegacyValue. The old public key, and, when ENCRYPTION_KEY was set after this
	// install had generated its own, that generated key.
	readOnlyKeys: string[];
	// True when that generated key is among them (for the startup log).
	replacesGeneratedKey: boolean;
}

// ENCRYPTION_KEY, when set (non-empty), is used verbatim, as it always was: changing how a
// set value is read would strand what it encrypted. Unset or empty, the installation uses
// the key it generated for itself on first run, kept next to the database (see
// utils/instanceSecret). Env and directory are injected for tests.
export function resolveEncryptionKey(env: NodeJS.ProcessEnv, dir: string): ResolvedEncryptionKey {
	const explicit = env.ENCRYPTION_KEY;
	if (explicit) {
		// An operator moving to a key of their own (a secret store) after the install made
		// one: what the generated key encrypted must stay readable, and then move.
		let previous: string | null = null;
		try {
			previous = readInstanceSecretIfPresent(dir, ENCRYPTION_KEY_FILE);
		} catch {
			// A damaged file cannot have encrypted anything readable; nothing to fall back to.
		}
		const replacesGeneratedKey = previous !== null && previous !== explicit;
		const readOnlyKeys = [LEGACY_PUBLIC_KEY, ...(replacesGeneratedKey ? [previous as string] : [])].filter(
			(candidate) => candidate !== explicit
		);
		return { key: explicit, source: 'env', readOnlyKeys, replacesGeneratedKey };
	}
	const generated = readOrCreateInstanceSecret(dir, ENCRYPTION_KEY_FILE);
	return {
		key: generated.secret,
		source: generated.created ? 'generated' : 'file',
		file: generated.file,
		readOnlyKeys: [LEGACY_PUBLIC_KEY],
		replacesGeneratedKey: false,
	};
}

let resolvedKey: ResolvedEncryptionKey | null = null;

// Resolved once per process. The worker resolves it too, from the same directory, so both
// processes always encrypt and decrypt with the same key.
export function initEncryptionKey(): ResolvedEncryptionKey {
	resolvedKey ??= resolveEncryptionKey(process.env, instanceSecretsDir());
	return resolvedKey;
}

function getEncryptionKey(): string {
	return initEncryptionKey().key;
}

const readOnlyKeys = (): string[] => initEncryptionKey().readOnlyKeys;

/**
 * Called once at server boot. A generated key needs no warning. A set ENCRYPTION_KEY that
 * is whitespace only, or is the old public value, is used verbatim and protects nothing,
 * so that is said, loudly, every boot (never a refusal to start: the data it encrypted
 * must stay readable). Env is injected so tests never mutate the shared process.env.
 */
export function warnIfEncryptionKeyInsecure(env: NodeJS.ProcessEnv = process.env): void {
	const key = env.ENCRYPTION_KEY;
	if (!key) return;
	if (key.trim().length === 0) {
		logger.warn(
			'ENCRYPTION_KEY is set to a whitespace-only value, which is used verbatim as a weak, ' +
				'easily-guessed encryption key. Set it to a strong, private secret, or unset it to ' +
				'let OpsiMate generate one (credentials saved under the old key must then be entered again).'
		);
		return;
	}
	if (key === LEGACY_PUBLIC_KEY) {
		logger.warn(
			'ENCRYPTION_KEY is set to the old public value, which ships in this repo — it protects ' +
				'nothing. Unset it to let OpsiMate generate a private key; stored credentials are ' +
				'moved to the new key on the next start.'
		);
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

	return combined.toString('base64');
}

// The plaintext under `masterKey`, or null when this is not a value that key encrypted
// (GCM's authentication tag makes a wrong key fail rather than return garbage).
function decryptWith(masterKey: string, encryptedPassword: string): string | null {
	try {
		const combined = Buffer.from(encryptedPassword, 'base64');
		if (combined.length <= SALT_LENGTH + IV_LENGTH + TAG_LENGTH) return null;

		const salt = combined.subarray(0, SALT_LENGTH);
		const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
		const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
		const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

		const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(masterKey, salt), iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encrypted, undefined, 'utf8');
		decrypted += decipher.final('utf8');
		return decrypted;
	} catch {
		return null;
	}
}

/**
 * Decrypt a password string. A value saved before the current key was in use (under the old
 * public key, or under the key this install generated before ENCRYPTION_KEY was set) is read
 * with that key; reencryptLegacyValue moves such values over at startup. Anything else is
 * returned as given, for values stored before encryption existed.
 *
 * `readOnlyKeys: false` skips those other keys, for input that cannot be an old stored value
 * (a password-reset token from a link, made minutes ago): each extra key is another PBKDF2
 * derivation, and such input may be anyone's guess.
 */
export function decryptPassword(
	encryptedPassword: string | undefined,
	{ readOnlyKeys: tryReadOnlyKeys = true }: { readOnlyKeys?: boolean } = {}
): string | undefined {
	if (!encryptedPassword) {
		return encryptedPassword;
	}
	const decrypted = decryptWith(getEncryptionKey(), encryptedPassword);
	if (decrypted !== null) return decrypted;
	if (tryReadOnlyKeys) {
		for (const key of readOnlyKeys()) {
			const old = decryptWith(key, encryptedPassword);
			if (old !== null) return old;
		}
	}
	logger.error('Failed to decrypt a stored value with the current encryption key');
	// Return the original value if decryption fails (for backward compatibility)
	return encryptedPassword;
}

/**
 * The same plaintext encrypted under the current key, when `value` is still under one of the
 * read-only keys (see decryptPassword); null when there is nothing to move (already under
 * the current key, or not a value any of them encrypted).
 */
export function reencryptLegacyValue(value: string | null | undefined): string | null {
	if (!value) return null;
	const masterKey = getEncryptionKey();
	if (decryptWith(masterKey, value) !== null) return null;
	let plaintext: string | null = null;
	for (const key of readOnlyKeys()) {
		plaintext = decryptWith(key, value);
		if (plaintext !== null) break;
	}
	if (plaintext === null) return null;
	const moved = encryptPassword(plaintext);
	// Never write back something that does not read back to the same value.
	if (!moved || decryptWith(masterKey, moved) !== plaintext) {
		throw new Error('Re-encrypting a stored credential did not round-trip; left it as it was');
	}
	return moved;
}

/**
 * Hash a string using SHA-512
 */
export function hashString(token: string): string {
	return crypto.createHash('sha512').update(token).digest('hex');
}

/**
 * How long a password-reset link stays valid, in minutes
 */
export const PASSWORD_RESET_TTL_MINUTES = 15;

/**
 * Generate a secure random token for password reset
 * Returns the encrypted token, the SHA-512 hash of the token, and the time the
 * token expires (PASSWORD_RESET_TTL_MINUTES from now)
 */
export function generatePasswordResetInfo(): {
	encryptedToken: string;
	tokenHash: string;
	expiresAt: Date;
} {
	const token = crypto.randomBytes(32).toString('hex');
	const encryptedToken = encryptPassword(token)!;
	const tokenHash = hashString(token);
	const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * MS_PER_MINUTE);
	return { encryptedToken, tokenHash, expiresAt };
}
