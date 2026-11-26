import { instanceSecretsDir } from '../dal/db';
import { InstanceSecret, readOrCreateInstanceSecret } from './instanceSecret';

// The key that signs login tokens (users controller) and verifies them (auth middleware).
// There is deliberately no built-in value: the old one, 'changeme-secret', shipped in this
// repo, so anyone could sign a token the server accepted, for any user and role.
//
// JWT_SECRET, when set, is used as given and must be at least 32 bytes. Unset (or blank),
// the installation generates its own on first run and keeps it next to the database (see
// utils/instanceSecret), so a default install is private with no setup. Set it yourself
// to manage it in a secret store, or when backend replicas do not share the database
// directory.
const MIN_SECRET_BYTES = 32;
export const JWT_SECRET_FILE = 'jwt-secret';

export interface ResolvedJwtSecret {
	secret: string;
	// Where it came from, for the startup log line.
	source: 'env' | 'generated' | 'file';
	file?: string;
}

// Env and directory are injected so tests never touch the shared process.env or a real
// data directory.
export function resolveJwtSecret(env: NodeJS.ProcessEnv, dir: string): ResolvedJwtSecret {
	const explicit = env.JWT_SECRET;
	if (explicit !== undefined && explicit.trim() !== '') {
		if (Buffer.byteLength(explicit.trim(), 'utf8') < MIN_SECRET_BYTES) {
			throw new Error(
				`JWT_SECRET is set but shorter than ${MIN_SECRET_BYTES} bytes. Set a longer private ` +
					'value (openssl rand -hex 32), or unset it to let OpsiMate generate one.'
			);
		}
		return { secret: explicit, source: 'env' };
	}
	const generated: InstanceSecret = readOrCreateInstanceSecret(dir, JWT_SECRET_FILE);
	return { secret: generated.secret, source: generated.created ? 'generated' : 'file', file: generated.file };
}

let resolved: ResolvedJwtSecret | null = null;

// Resolved once per process: signing and verification must agree, and the file is read
// on the first call rather than on every request.
export function initJwtSecret(): ResolvedJwtSecret {
	resolved ??= resolveJwtSecret(process.env, instanceSecretsDir());
	return resolved;
}

export function getJwtSecret(): string {
	return initJwtSecret().secret;
}
