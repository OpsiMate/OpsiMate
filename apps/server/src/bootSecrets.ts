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

// Credentials an older version encrypted with the public built-in key move to this
// install's own key. Best effort: on any problem nothing is changed and the server starts
// anyway, since they stay readable either way.
export function moveLegacyCredentials(db: Database.Database): void {
	try {
		const moved = reencryptLegacyCredentials(db);
		const total = Object.values(moved).reduce((sum, count) => sum + count, 0);
		if (total > 0) {
			const detail = Object.entries(moved)
				.map(([table, count]) => `${table}: ${count}`)
				.join(', ');
			logger.info(`Moved ${total} stored credential(s) off the old public encryption key (${detail})`);
		}
	} catch (error) {
		logger.error('Could not move stored credentials to this install’s encryption key; left as they were', error);
	}
}
