// The key that signs login tokens (users controller) and verifies them (auth middleware).
// There is deliberately no fallback: the old one, 'changeme-secret', shipped in this repo,
// so anyone could sign a token the server accepted, for any user and role. 32 bytes is a
// floor, not proof of randomness: generate the value with `openssl rand -hex 32`.
const MIN_SECRET_BYTES = 32;

// Env is injected so tests can pass values in without touching the shared process.env.
export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
	const secret = env.JWT_SECRET;

	if (!secret || Buffer.byteLength(secret.trim(), 'utf8') < MIN_SECRET_BYTES) {
		throw new Error(
			`JWT_SECRET must be set to a private secret of at least ${MIN_SECRET_BYTES} bytes. ` +
				'Generate one with: openssl rand -hex 32'
		);
	}

	return secret;
}
