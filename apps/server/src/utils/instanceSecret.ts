import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Secrets an installation makes for itself the first time it runs (the key that signs login
// sessions, the key that encrypts stored credentials) when the operator has not supplied one.
// Each install gets its own random value, so nothing protecting real data is ever a value that
// ships in this repo, and nobody has to generate one by hand to get started.
//
// They live as files next to the database: the database directory is the one place every
// working install keeps across restarts (without it, alerts vanish), so a generated key never
// silently changes underneath the data it protects. Back the files up with the database.

export const INSTANCE_SECRET_BYTES = 32;

const HEX_SECRET = /^[0-9a-f]+$/;

// Filesystems without hard links (some network and Windows-backed volumes) report one of these.
const NO_HARD_LINKS = new Set(['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EXDEV']);

export interface InstanceSecret {
	secret: string;
	file: string;
	// True when this call wrote the file (a first run), false when it already existed.
	created: boolean;
}

// Reads `<dir>/<name>`, creating it with 32 random bytes (as hex) the first time. Safe when the
// server and the worker start together: the value is written under a temporary name and
// hard-linked into place, which fails if another process got there first, so a reader never
// sees a half-written file and both processes end up with the same secret. Mode 0600.
//
// A file that exists but does not hold a usable secret is an error, never a reason to make a
// new one: replacing it would sign everyone out, or strand the credentials it encrypted.
export function readOrCreateInstanceSecret(dir: string, name: string): InstanceSecret {
	const file = path.join(dir, name);
	const existing = readSecretFile(file);
	if (existing !== null) return { secret: existing, file, created: false };

	fs.mkdirSync(dir, { recursive: true });
	const secret = crypto.randomBytes(INSTANCE_SECRET_BYTES).toString('hex');
	const tmp = path.join(dir, `.${name}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
	try {
		fs.writeFileSync(tmp, `${secret}\n`, { mode: 0o600, flag: 'wx' });
		try {
			fs.linkSync(tmp, file);
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code ?? '';
			if (code === 'EEXIST') return { secret: readWinner(file), file, created: false };
			if (!NO_HARD_LINKS.has(code)) throw error;
			// No hard links here: an exclusive create still guarantees a single writer.
			try {
				fs.writeFileSync(file, `${secret}\n`, { mode: 0o600, flag: 'wx' });
			} catch (fallbackError) {
				if ((fallbackError as NodeJS.ErrnoException).code !== 'EEXIST') throw fallbackError;
				return { secret: readWinner(file), file, created: false };
			}
		}
		return { secret, file, created: true };
	} finally {
		fs.rmSync(tmp, { force: true });
	}
}

// Another process created the file between our read and our write: theirs is the secret.
// Without hard links that process may still be writing it, so give it a moment.
function readWinner(file: string): string {
	for (let attempt = 0; attempt < 20; attempt++) {
		const value = readSecretFile(file, { allowEmpty: true });
		if (value) return value;
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
	}
	throw new Error(`${file} was created by another process but is still empty`);
}

function readSecretFile(file: string, { allowEmpty = false } = {}): string | null {
	let raw: string;
	try {
		raw = fs.readFileSync(file, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
	const value = raw.trim();
	if (value === '' && allowEmpty) return null;
	if (!HEX_SECRET.test(value) || value.length < INSTANCE_SECRET_BYTES * 2) {
		throw new Error(
			`${file} does not hold a usable secret. Restore it from a backup; only if nothing ` +
				'depends on it any more (everyone will be signed out, and credentials it encrypted ' +
				'must be entered again), delete it so OpsiMate generates a new one.'
		);
	}
	return value;
}
