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

// What this module writes: lowercase hex. A shorter run of it may be a write in progress.
const OWN_FORMAT = /^[0-9a-f]*$/;

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
// (On a filesystem without hard links another process may still be writing it, so an empty
// or short-but-hex file is waited for, briefly, before it counts as damaged.)
export function readOrCreateInstanceSecret(
	dir: string,
	name: string,
	{ settleMs = SETTLE_MS }: { settleMs?: number } = {}
): InstanceSecret {
	const file = path.join(dir, name);
	// lstat, not exists: a symlink whose target is missing is still "there", and must be
	// reported rather than replaced.
	if (isPresent(file)) return existingSecret(file, settleMs);

	fs.mkdirSync(dir, { recursive: true });
	const secret = crypto.randomBytes(INSTANCE_SECRET_BYTES).toString('hex');
	const tmp = path.join(dir, `.${name}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
	try {
		fs.writeFileSync(tmp, `${secret}\n`, { mode: 0o600, flag: 'wx' });
		try {
			fs.linkSync(tmp, file);
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code ?? '';
			if (code === 'EEXIST') return existingSecret(file, settleMs);
			if (!NO_HARD_LINKS.has(code)) throw error;
			// No hard links here: an exclusive create still guarantees a single writer.
			try {
				fs.writeFileSync(file, `${secret}\n`, { mode: 0o600, flag: 'wx' });
			} catch (fallbackError) {
				if ((fallbackError as NodeJS.ErrnoException).code !== 'EEXIST') throw fallbackError;
				return existingSecret(file, settleMs);
			}
		}
		return { secret, file, created: true };
	} finally {
		fs.rmSync(tmp, { force: true });
	}
}

// The secret in `<dir>/<name>` if this install has one, never creating it: null when the file
// is absent. Used to find a key the install generated earlier, before an operator set one.
export function readInstanceSecretIfPresent(dir: string, name: string): string | null {
	const file = path.join(dir, name);
	return isPresent(file) ? existingSecret(file, SETTLE_MS).secret : null;
}

const isPresent = (file: string): boolean => {
	try {
		fs.lstatSync(file);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
};

function existingSecret(file: string, settleMs: number): InstanceSecret {
	const secret = readSettled(file, settleMs);
	keepPrivate(file);
	return { secret, file, created: false };
}

// The file is created 0600, but a recursive chmod on the data directory (an install script
// run with sudo, say) can open it up. Put it back on every start; best effort, since a file
// we do not own cannot be changed and is still readable to us.
function keepPrivate(file: string): void {
	try {
		if ((fs.statSync(file).mode & 0o077) !== 0) fs.chmodSync(file, 0o600);
	} catch {
		// Not ours to change; the secret is still read.
	}
}

// How long a file that looks mid-write (empty, or hex but too short) is waited for.
const SETTLE_MS = 1000;
const SETTLE_STEP_MS = 50;

type SecretFileState = { kind: 'complete'; value: string } | { kind: 'incomplete' } | { kind: 'invalid' };

// Any single token of at least 32 bytes is a usable secret, whatever its encoding (hex in any
// case, base64...), so a file restored or written by hand is taken as it is. Only a run of
// lowercase hex shorter than what this module writes can be its own write still in progress.
const classify = (raw: string): SecretFileState => {
	const value = raw.trim();
	if (OWN_FORMAT.test(value) && value.length < INSTANCE_SECRET_BYTES * 2) return { kind: 'incomplete' };
	if (/\s/.test(value) || Buffer.byteLength(value, 'utf8') < INSTANCE_SECRET_BYTES) return { kind: 'invalid' };
	return { kind: 'complete', value };
};

// The file's secret, once complete. Content that cannot be a write in progress fails at once;
// content that could be (empty, a short lowercase-hex prefix) gets `settleMs` to finish, then
// fails the same way. Never replaced either way.
function readSettled(file: string, settleMs: number): string {
	const deadline = Date.now() + settleMs;
	for (;;) {
		let raw: string;
		try {
			raw = fs.readFileSync(file, 'utf8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			throw new Error(
				`${file} points to a file that does not exist (a symlink to a secret that is not ` +
					'mounted yet?). Make the target available, or remove the link to let OpsiMate generate one.',
				{ cause: error }
			);
		}
		const state = classify(raw);
		if (state.kind === 'complete') return state.value;
		if (state.kind === 'invalid' || Date.now() >= deadline) break;
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, SETTLE_STEP_MS);
	}
	throw new Error(
		`${file} does not hold a usable secret (one value of at least ${INSTANCE_SECRET_BYTES} bytes, no spaces). ` +
			'Restore it from a backup; only if nothing depends on it any more (everyone will be ' +
			'signed out, and credentials it encrypted must be entered again), delete it so OpsiMate ' +
			'generates a new one.'
	);
}
