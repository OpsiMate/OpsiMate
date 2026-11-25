import * as path from 'node:path';
import Database from 'better-sqlite3';
import { Logger } from '@OpsiMate/shared';
import { getSecurityConfig } from './config/config';
import { reencryptLegacyCredentials } from './dal/reencryptLegacyCredentials';
import { instanceSecretsDir } from './dal/db';
import { initEncryptionKey, warnIfEncryptionKeyInsecure } from './utils/encryption';
import { directoriesWritableByOthers } from './utils/instanceSecret';
import { initJwtSecret } from './utils/jwtSecret';

const logger = new Logger('server/secrets');

const describe = (what: string, source: 'env' | 'generated' | 'file', file?: string): string => {
	if (source === 'env') return `${what}: from the environment`;
	if (source === 'generated') {
		return `${what}: generated a private one in ${file} — back it up with the database`;
	}
	return `${what}: using the one this install generated, ${file}`;
};

// The server's two keys, settled before anything uses them: the one that signs login
// sessions and the one that encrypts stored credentials. Each comes from the environment
// when set, otherwise from the file this install generated next to its database. Throws
// (the server does not start) on a JWT_SECRET that is set but too short, or a generated
// file that is damaged.
// Starts that bypass the install script (docker compose run by hand, a directory an older
// script made 0777) are told when the key directory is not private, every start.
const warnIfKeyDirectoryOpen = (): void => {
	const open = directoriesWritableByOthers(instanceSecretsDir());
	if (open.length > 0) {
		logger.warn(
			`${open.join(' and ')} can be written by other users, who could then replace this install's ` +
				`login-session and encryption keys. Make ${open.length > 1 ? 'them' : 'it'} owner-only: chmod 700 ${open.join(' ')}`
		);
	}
};

export function prepareInstanceSecrets(): void {
	warnIfKeyDirectoryOpen();
	const jwt = initJwtSecret();
	logger.info(describe('Login session key', jwt.source, jwt.file));
	prepareEncryptionKey();
}

// The worker's half: it never signs a session, but it decrypts credentials, so a damaged
// key file must stop it at startup too, not surface later as failing jobs.
export function prepareEncryptionKey(): void {
	const encryption = initEncryptionKey();
	logger.info(describe('Credential encryption key', encryption.source, encryption.file));
	if (encryption.replacesGeneratedKey) {
		logger.warn(
			'ENCRYPTION_KEY is set and differs from the key this install generated earlier. Credentials ' +
				'saved under that key are still read with it and are moved to ENCRYPTION_KEY on this start; ' +
				'keep the generated file until that has happened.'
		);
	}
	warnIfEncryptionKeyInsecure();
}

const summarize = (counts: Record<string, number>): { total: number; detail: string } => ({
	total: Object.values(counts).reduce((sum, count) => sum + count, 0),
	detail: Object.entries(counts)
		.map(([table, count]) => `${table}: ${count}`)
		.join(', '),
});

// Credentials an older version encrypted with the public built-in key move to this
// install's own key, in the background (see reencryptLegacyCredentials). Best effort:
// whatever does not move stays readable through the fallback and is tried again on the
// next start. Never throws.
export async function moveLegacyCredentials(db: Database.Database): Promise<void> {
	try {
		const keysDir = path.resolve(getSecurityConfig().private_keys_path);
		const { moved, failed } = await reencryptLegacyCredentials(db, { keysDir });
		const done = summarize(moved);
		if (done.total > 0) {
			logger.info(`Moved ${done.total} stored credential(s) to the current encryption key (${done.detail})`);
		}
		const left = summarize(failed);
		if (left.total > 0) {
			logger.warn(
				`Could not move ${left.total} stored credential(s) to the current encryption key (${left.detail}); ` +
					'they still work and are tried again on the next start'
			);
		}
	} catch (error) {
		logger.error('Could not move stored credentials to this install’s encryption key; left as they were', error);
	}
}
