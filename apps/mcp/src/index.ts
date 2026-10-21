// Library surface: what tests (and anyone embedding the server) need. The runnable is cli.ts.
export { readConfig, DEFAULT_PATH, DEFAULT_PORT, DEFAULT_RATE_LIMIT_PER_MINUTE } from './config';
export type { McpConfig } from './config';
export { createHttpApp } from './http/app';
export { createRateLimit } from './http/rateLimit';
export { createMcpServer } from './mcp/server';
export { callerKey, credentialsFromEnv, credentialsFromHeaders } from './opsimate/auth';
export type { CallerCredentials } from './opsimate/auth';
export { OpsiMateApiError, OpsiMateClient } from './opsimate/client';
export { serveOverStdio } from './stdio';
