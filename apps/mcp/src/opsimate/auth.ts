import { createHash } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

// The credential an MCP client presents, forwarded to OpsiMate exactly as received:
// the instance API token (x-api-token) or a user's login token (Authorization: Bearer).
// Nothing is verified here — OpsiMate is the authority, and it sees the real caller, so
// its permissions (a Viewer stays a Viewer) and its logs apply. Tokens in the query
// string are deliberately not accepted: they end up in proxy and access logs.
export interface CallerCredentials {
	// The header to send OpsiMate, as a single [name, value] pair.
	header: ['x-api-token' | 'authorization', string];
}

export const credentialsFromHeaders = (headers: IncomingHttpHeaders): CallerCredentials | null => {
	const apiToken = headers['x-api-token'];
	if (typeof apiToken === 'string' && apiToken.trim() !== '') return { header: ['x-api-token', apiToken] };
	const authorization = headers.authorization;
	if (typeof authorization === 'string' && /^Bearer\s+\S/.test(authorization)) {
		return { header: ['authorization', authorization] };
	}
	return null;
};

// stdio mode: the credential comes from the environment of the process the MCP client
// started. OPSIMATE_API_TOKEN is the instance token; OPSIMATE_TOKEN a user's login token.
export const credentialsFromEnv = (env: NodeJS.ProcessEnv): CallerCredentials | null => {
	const apiToken = env.OPSIMATE_API_TOKEN?.trim();
	if (apiToken) return { header: ['x-api-token', apiToken] };
	const userToken = env.OPSIMATE_TOKEN?.trim();
	if (userToken)
		return {
			header: ['authorization', `Bearer ${userToken.replace(/^Bearer\s+/i, '')}`],
		};
	return null;
};

// A stable, unguessable key for a credential (rate limiting, logs) that never contains
// the credential itself.
export const callerKey = (credentials: CallerCredentials): string =>
	createHash('sha256').update(credentials.header.join(':')).digest('hex').slice(0, 16);
