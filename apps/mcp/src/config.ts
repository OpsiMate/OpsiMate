// Everything the MCP server is told from outside: where OpsiMate is, how to listen, and
// (stdio mode only) which credential to use. Read once at startup.

export interface McpConfig {
	// OpsiMate's base URL, e.g. http://backend:3001 (no trailing slash).
	opsimateUrl: string;
	host: string;
	port: number;
	// Where the Streamable HTTP endpoint lives.
	path: string;
	// Requests per caller per minute; 0 = no limit.
	rateLimitPerMinute: number;
	// Reported to MCP clients as the server version.
	version: string;
	// How long a single call to OpsiMate may take.
	opsimateTimeoutMs: number;
}

export const DEFAULT_PORT = 3100;
export const DEFAULT_PATH = '/mcp';
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 240;
export const DEFAULT_OPSIMATE_TIMEOUT_MS = 15_000;

const nonNegativeInt = (raw: string | undefined, fallback: number): number => {
	const trimmed = (raw ?? '').trim();
	if (trimmed === '') return fallback;
	const parsed = Number(trimmed);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

export const readConfig = (env: NodeJS.ProcessEnv = process.env): McpConfig => {
	const port = nonNegativeInt(env.MCP_PORT, DEFAULT_PORT);
	return {
		opsimateUrl: (env.OPSIMATE_URL ?? 'http://localhost:3001').trim().replace(/\/+$/, ''),
		host: (env.MCP_HOST ?? '0.0.0.0').trim() || '0.0.0.0',
		port: port > 0 ? port : DEFAULT_PORT,
		path: normalizePath(env.MCP_PATH),
		rateLimitPerMinute: nonNegativeInt(env.MCP_RATE_LIMIT_PER_MINUTE, DEFAULT_RATE_LIMIT_PER_MINUTE),
		version: (env.APP_VERSION ?? '').trim() || 'dev',
		opsimateTimeoutMs:
			nonNegativeInt(env.OPSIMATE_TIMEOUT_MS, DEFAULT_OPSIMATE_TIMEOUT_MS) || DEFAULT_OPSIMATE_TIMEOUT_MS,
	};
};

const normalizePath = (raw: string | undefined): string => {
	const trimmed = (raw ?? '').trim();
	if (trimmed === '' || trimmed === '/') return DEFAULT_PATH;
	return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
};
