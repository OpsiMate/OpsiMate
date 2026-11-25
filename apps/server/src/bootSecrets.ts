import Database from 'better-sqlite3';
import { Logger } from '@OpsiMate/shared';
import { reencryptLegacyCredentials } from './dal/reencryptLegacyCredentials';
import { initEncryptionKey, warnIfEncryptionKeyInsecure } from './utils/encryption';
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
export function prepareInstanceSecrets(): void {
	const jwt = initJwtSecret();
	logger.info(describe('Login session key', jwt.source, jwt.file));
	const encryption = initEncryptionKey();
	logger.info(describe('Credential encryption key', encryption.source, encryption.file));
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
		const { moved, failed } = await reencryptLegacyCredentials(db);
		const done = summarize(moved);
		if (done.total > 0) {
			logger.info(`Moved ${done.total} stored credential(s) off the old public encryption key (${done.detail})`);
		}
		const left = summarize(failed);
		if (left.total > 0) {
			logger.warn(
				`Could not move ${left.total} stored credential(s) off the old public key (${left.detail}); ` +
					'they still work and are tried again on the next start'
			);
		}
	} catch (error) {
		logger.error('Could not move stored credentials to this install’s encryption key; left as they were', error);
	}
}
